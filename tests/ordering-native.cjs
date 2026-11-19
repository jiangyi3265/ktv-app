const auto = require(process.env.MINIPROGRAM_AUTOMATOR_MODULE || 'miniprogram-automator');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const output = process.env.KTV_TEST_OUTPUT || '.local/ordering-native';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const m = await auto.connect({ wsEndpoint: process.env.KTV_AUTOMATOR_WS || 'ws://127.0.0.1:9456' });
  const cdp = m.CDP(), errors = [], checks = [];
  m.on('exception', e => errors.push(e.message || String(e)));
  const flatten = n => [n, ...(n.children || []).flatMap(flatten)];
  const text = n => (n.nodeValue || '') + (n.children || []).map(text).join('');
  const tree = async () => flatten((await cdp.sendCommand('DOM', 'getDocument', { depth: -1, pierce: true })).root);
  const until = async (fn, label) => { for (let i = 0; i < 80; i++) { if (await fn()) return; await sleep(150); } throw Error('Timeout: ' + label); };
  const visible = async label => {
    // Mini-program slots retain zero-size nodes even when their v-if host is hidden.
    for(const n of (await tree()).filter(n=>n.nodeValue?.trim()===label)) {
      try {const box=(await cdp.sendCommand('DOM','getBoxModel',{nodeId:n.parentId})).model;if(box.width>0&&box.height>0)return true;}catch{}
    }
    return false;
  };
  const tap = async label => {
    await until(async () => (await tree()).some(n => n.nodeName === 'button' && text(n).trim() === label), label);
    const n = (await tree()).find(n => n.nodeName === 'button' && text(n).trim() === label);
    await cdp.sendCommand('MDPElement', 'tap', { nodeId: n.nodeId });
  };
  try {
    await cdp.sendCommand('DOM', 'enable', {});
    assert.match(await m.evaluate(() => require('common/api.js').apiUrl('/ktv-api/state')), /^https:\/\/[^/]+\/ktv-api\/state$/);
    await m.mockWxMethod('login', {code:'ordering-fixture',errMsg:'login:ok'});
    await m.evaluate(async () => {
      const app=getApp(), api=require('common/api.js'), s=require('common/store.js');s.state.foreground=false;s.pauseSync();
      await s.activate('supplier');s.pauseSync();
      app.__orderingOriginal=api.request;app.__orderingBefore=wx.getStorageSync('ktv-session-customer-v1');app.__orderingEnabled=false;app.__orderingRevision=1;app.__orderingUnexpected=[];
      wx.removeStorageSync('ktv-session-customer-v1');
      api.request=async (url) => {
        if(url==='/site-settings')return {staffPortalEnabled:true};
        if(url==='/sessions/wechat')return {role:'customer',token:'ordering-fixture-customer'};
        if(url==='/session')return {ok:true};
        if(url.startsWith('/state?'))return {role:'customer',subject:'wx-fixture',revision:app.__orderingRevision,page:1,orderingEnabled:app.__orderingEnabled,products:app.__orderingEnabled?[{id:'chicken',name:'宫保鸡丁饭',price:32,category:'主食',image:'chicken',description:'经典川味',onSale:true}]:[],orders:[],rooms:[],accounts:[],orderDetail:null,orderCounts:{},orderAlerts:[],hasMore:false};
        if(url==='/notifications/status')return {enabled:false,bound:false,credits:0};
        app.__orderingUnexpected.push(url);throw Error('Unexpected test request');
      };
    });
    for(const target of ['pages/index/index','pages/customer/cart','pages/customer/checkout','pages/customer/payment']) {
      await m.reLaunch('/'+target);await until(async()=> (await m.currentPage()).path==='pages/service/index' && await visible('食堂接单'),target+' redirects');
      for(const label of ['暂停营业','点餐','去点餐','返回首页']) assert(!(await visible(label)),label+' hidden');
      assert(!(await visible('好好吃饭，尽兴开唱')));assert(!(await visible('确认并支付')));
      checks.push(target+'-closed');
      console.log('Verified hidden ordering route:', target);
    }
    await m.reLaunch('/pages/index/index');await until(async()=> (await m.currentPage()).path==='pages/service/index' && await visible('商家管理'),'home redirects');
    await m.screenshot({path:path.resolve(output,'closed.png')});
    await m.reLaunch('/pages/customer/orders');await until(()=>visible('食堂登录'),'old order deep link');await tap('首页');await until(async()=> (await m.currentPage()).path==='pages/service/index','orders home button');checks.push('old-orders-have-working-home-button');
    await m.evaluate(async()=>{const app=getApp();app.__orderingEnabled=true;app.__orderingRevision++;await require('common/store.js').refresh()});
    await until(()=>visible('进入点餐'),'reopened navigation');await m.reLaunch('/pages/index/index');await until(()=>visible('好好吃饭，尽兴开唱'),'reopened original menu');checks.push('reopen-restores-menu');
    await m.reLaunch('/pages/customer/orders');await until(()=>visible('食堂登录'),'reopened orders');await tap('点餐');await until(async()=> (await m.currentPage()).path==='pages/index/index','orders return directly to menu');checks.push('open-orders-return-directly-to-menu');
    await m.reLaunch('/pages/service/index');await until(()=>visible('进入点餐'),'saved service entry');await tap('点餐');await until(async()=> (await m.currentPage()).path==='pages/index/index','service home returns directly to menu');checks.push('saved-service-page-has-menu-navigation');
    await m.evaluate(()=>{require('common/store.js').state.cart={chicken:1}});
    await m.reLaunch('/pages/customer/cart');
    await m.evaluate(async()=>{const app=getApp();app.__orderingEnabled=false;app.__orderingRevision++;await require('common/store.js').refresh()});
    await until(async()=> (await m.currentPage()).path==='pages/service/index' && await visible('食堂接单'),'close while cart open');
    assert.equal(await m.evaluate(()=>Object.keys(require('common/store.js').state.cart).length),0);checks.push('close-hides-cart-and-clears-selection');
    await m.reLaunch('/pages/customer/orders');await until(()=>visible('食堂登录'),'staff access');assert(await visible('商家管理'));checks.push('history-and-staff-access-remain');
    await m.callWxMethod('navigateTo',{url:'/pages/supplier/workbench'});await until(async()=> (await m.currentPage()).path==='pages/supplier/workbench','supplier route');await sleep(1200);assert.equal((await m.currentPage()).path,'pages/supplier/workbench');checks.push('hidden-customer-page-cannot-redirect-staff');
    await m.callWxMethod('navigateBack');await until(()=>visible('食堂登录'),'return to customer history');checks.push('back-navigation-remains-usable');
    assert.deepEqual(await m.evaluate(()=>getApp().__orderingUnexpected),[]);assert.deepEqual(errors,[]);
    const report={version:JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8')).version,checks,errors,transportMocked:true,realOrdersChanged:false};
    fs.writeFileSync(path.resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  } finally {
    await m.evaluate(()=>{const app=getApp(),s=require('common/store.js');s.state.foreground=false;s.pauseSync();if(app.__orderingOriginal)require('common/api.js').request=app.__orderingOriginal;if(app.__orderingBefore)wx.setStorageSync('ktv-session-customer-v1',app.__orderingBefore);else wx.removeStorageSync('ktv-session-customer-v1');delete app.__orderingOriginal;delete app.__orderingBefore;}).catch(()=>{});
    await m.restoreWxMethod('login').catch(()=>{});await m.disconnect();
  }
})().catch(e=>{console.error(e.message);process.exitCode=1});
