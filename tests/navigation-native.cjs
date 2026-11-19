const auto = require(process.env.MINIPROGRAM_AUTOMATOR_MODULE || 'miniprogram-automator');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const output = process.env.KTV_TEST_OUTPUT || '.local/navigation-native';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Expected destinations are intentionally separate from the implementation.
const routes = [
  ['index/index','service/index'], ['customer/cart','index/index'], ['customer/checkout','index/index'],
  ['customer/payment','customer/orders'], ['customer/success','customer/orders'], ['customer/orders','index/index'],
  ['customer/progress','customer/orders'], ['customer/completed','customer/orders'],
  ['supplier/workbench','service/index'], ['supplier/detail','supplier/workbench'],
  ['supplier/preparing','supplier/workbench'], ['supplier/delivery','supplier/workbench'],
  ['admin/index','service/index'], ['admin/rooms','admin/index'], ['admin/qrcode','admin/rooms'],
  ['admin/products','admin/index'], ['admin/product-edit','admin/products'], ['admin/orders','admin/index'],
  ['admin/order-detail','admin/orders'], ['admin/accounts','admin/index'], ['admin/permissions','admin/accounts'],
  ['admin/payment','admin/accounts'], ['supplier/ledger','supplier/workbench'], ['service/index','index/index'],
];
(async () => {
  fs.mkdirSync(output,{recursive:true});
  const m=await auto.connect({wsEndpoint:process.env.KTV_AUTOMATOR_WS || 'ws://127.0.0.1:9457'});
  console.log('Connected to owned mini-program project');
  const cdp=m.CDP(), checks=[], errors=[];
  m.on('exception',e=>errors.push(e.message || String(e)));
  const flatten=n=>[n,...(n.children||[]).flatMap(flatten)];
  const tree=async()=>flatten((await cdp.sendCommand('DOM','getDocument',{depth:-1,pierce:true})).root);
  const hasClass=(n,c)=>{const a=n.attributes||[];return a.some((v,i)=>v==='class'&&String(a[i+1]).split(/\s+/).includes(c))};
  const until=async(fn,label)=>{for(let i=0;i<80;i++){if(await fn())return;await sleep(150)}throw Error('Timeout: '+label)};
  const backButton=async()=>{
    for(const n of (await tree()).reverse().filter(n=>n.nodeName==='button'&&(hasClass(n,'return-button')||hasClass(n,'cart-return')))) {
      try{const box=(await cdp.sendCommand('DOM','getBoxModel',{nodeId:n.nodeId})).model;if(box.width>0&&box.height>=44)return n}catch{}
    }
    return null;
  };
  const tapBack=async()=>{await until(backButton,'visible return button');await cdp.sendCommand('MDPElement','tap',{nodeId:(await backButton()).nodeId})};
  const ready=()=>until(()=>m.evaluate(()=>require('common/store.js').connection.ready),'connected page');
  const at=route=>until(async()=>(await m.currentPage()).path==='pages/'+route,route);
  try {
    await cdp.sendCommand('DOM','enable',{});console.log('DOM ready');
    await m.mockWxMethod('login',{code:'navigation-fixture',errMsg:'login:ok'});console.log('Login mock ready');
    await m.evaluate(async()=>{
      const app=getApp(),s=require('common/store.js'),api=require('common/api.js');
      s.state.foreground=false;s.pauseSync();await s.activate('supplier');s.pauseSync();
      app.__navOriginal=api.request;app.__navBefore={};app.__navEnabled=true;app.__navRevision=1;app.__navUnexpected=[];
      for(const role of ['customer','supplier','admin']){app.__navBefore[role]=wx.getStorageSync('ktv-session-'+role+'-v1');wx.setStorageSync('ktv-session-'+role+'-v1',{role,token:'nav-'+role})}
      api.request=async(url,options={})=>{
        if(url==='/site-settings')return {staffPortalEnabled:true};
        const role=(options.token||'').includes('admin')?'admin':(options.token||'').includes('supplier')?'supplier':'customer';
        if(url==='/session')return {ok:true};
        if(url==='/sessions/wechat')return {role:'customer',token:'nav-customer'};
        if(url.startsWith('/state?'))return {role,subject:role==='supplier'?'A01':role==='admin'?'pc-1':'wx-fixture',revision:app.__navRevision,page:1,orderingEnabled:app.__navEnabled,products:[],orders:[],rooms:[],accounts:role==='supplier'?[{id:'A01',name:'测试食堂',enabled:true,process:true,deliver:true}]:[],orderDetail:null,orderCounts:{},orderAlerts:[],hasMore:false};
        if(url==='/notifications/status')return {enabled:false,bound:false,credits:0};
        if(url.startsWith('/finance/ledger'))return {entries:[],total:0,receiptCents:0,refundCents:0,netCents:0};
        if(url==='/readiness')return {};
        if(url.startsWith('/rooms/') && url.includes('/qr?'))return {image:''};
        app.__navUnexpected.push(url);throw Error('Unexpected test request: '+url);
      };
    });
    console.log('Fixture ready');
    for(const [route,target] of routes){
      console.log('Opening '+route);await sleep(1000);await m.evaluate(url=>{setTimeout(()=>wx.reLaunch({url}),100);return true},'/pages/'+route);await at(route);await ready();await sleep(500);console.log('Opened '+route);await until(backButton,'back on '+route);
      console.log('Tapping return on '+route);
      await tapBack();await at(target);await ready();await sleep(700);
      assert.equal(await m.evaluate(()=>getCurrentPages().length),1,'Fallback must not create a back loop');
      checks.push('cold-entry:'+route+' -> '+target);console.log(checks.at(-1));
    }
    assert.deepEqual(await m.evaluate(()=>getApp().__navUnexpected),[]);assert.deepEqual(errors,[]);
    const report={version:JSON.parse(fs.readFileSync(path.join(__dirname,'../package.json'),'utf8')).version,pages:routes.length,checks,errors,transportMocked:true,realOrdersChanged:false};
    fs.writeFileSync(path.resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{
    await m.evaluate(()=>{const app=getApp(),s=require('common/store.js');s.state.foreground=false;s.pauseSync();if(app.__navOriginal)require('common/api.js').request=app.__navOriginal;for(const role of ['customer','supplier','admin']){const v=app.__navBefore?.[role];if(v)wx.setStorageSync('ktv-session-'+role+'-v1',v);else wx.removeStorageSync('ktv-session-'+role+'-v1')}}).catch(()=>{});
    await m.restoreWxMethod('login').catch(()=>{});await m.disconnect();
  }
})().catch(e=>{console.error(e);process.exitCode=1});
