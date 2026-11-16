const auto = require(process.env.MINIPROGRAM_AUTOMATOR_MODULE || 'miniprogram-automator');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const output = process.env.KTV_TEST_OUTPUT || '.local/notifications-native';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const m = await auto.connect({ wsEndpoint: process.env.KTV_AUTOMATOR_WS || 'ws://127.0.0.1:9441' });
  const cdp = m.CDP(), errors = [], checks = [];
  m.on('exception', e => errors.push(e.message || String(e)));
  const flatten = n => [n, ...(n.children || []).flatMap(flatten)];
  const text = n => (n.nodeValue || '') + (n.children || []).map(text).join('');
  const tree = async () => flatten((await cdp.sendCommand('DOM', 'getDocument', { depth: -1, pierce: true })).root);
  const until = async (fn, label) => { for (let i = 0; i < 80; i++) { if (await fn()) return; await sleep(150); } throw Error('Timeout: ' + label); };
  const tap = async label => {
    await until(async () => (await tree()).some(n => n.nodeName === 'button' && text(n).trim() === label), label);
    const n = (await tree()).find(n => n.nodeName === 'button' && text(n).trim() === label);
    await cdp.sendCommand('MDPElement', 'tap', { nodeId: n.nodeId });
  };
  try {
    await cdp.sendCommand('DOM', 'enable', {});
    await m.mockWxMethod('login', { code: 'fixture-notice-code', errMsg: 'login:ok' });
    await m.mockWxMethod('requestSubscribeMessage', { 'fixture-staff': 'accept', 'fixture-customer': 'accept', errMsg: 'requestSubscribeMessage:ok' });
    await m.evaluate(() => {
      const app = getApp(), api = require('common/api.js');
      app.__noticeOriginal = api.request; app.__noticeCalls = []; app.__noticeState = {}; app.__noticeUnexpected = [];
      for (const role of ['customer', 'supplier', 'admin']) app.__noticeState[role] = { enabled: true, templateReady: true, templateId: role === 'customer' ? 'fixture-customer' : 'fixture-staff', bound: false, credits: 0 };
      api.request = (url, options = {}) => {
        const role = (options.token || '').startsWith('pc.') ? 'admin' : (options.token || '').includes('supplier') ? 'supplier' : 'customer';
        app.__noticeCalls.push({ url, role, data: options.data });
        if (url === '/sessions/wechat') return Promise.resolve({ role: 'customer', token: 'fixture-customer' });
        if (url === '/sessions/pc-admin') return Promise.resolve({ role: 'admin', token: 'pc.fixture-pc' });
        if (url === '/session') return Promise.resolve({ ok: true });
        if (url.startsWith('/state?')) return Promise.resolve({ role, subject: role === 'admin' ? 'pc-1' : role === 'supplier' ? 'A01' : 'wx-fixture', revision: 1, page: 1, products: [], orders: [], rooms: [], accounts: role === 'supplier' ? [{ id: 'A01', name: '测试备货', enabled: true, process: true, deliver: true }] : [], orderDetail: null, orderCounts: {}, orderAlerts: [], hasMore: false });
        const state = app.__noticeState[role];
        if (url === '/notifications/status') return Promise.resolve({ ...state });
        if (url === '/notifications/bind') {
          if (options.method === 'DELETE') { state.bound = false; state.credits = 0; return Promise.resolve({ ok: true }); }
          state.bound = true;
          if (app.__noticeHoldBind) return new Promise(resolve => { app.__noticeFinishBind = resolve; });
          return Promise.resolve({ nonce: 'fixture-nonce-' + role, templateId: state.templateId });
        }
        if (url === '/notifications/subscribe') { if (options.data.accepted) state.credits++; return Promise.resolve({ ...state }); }
        app.__noticeUnexpected.push(url); return Promise.reject(Error('Unexpected fixture request: ' + url));
      };
      wx.setStorageSync('ktv-session-customer-v1', { role: 'customer', token: 'fixture-customer' });
      wx.setStorageSync('ktv-session-supplier-v1', { role: 'supplier', token: 'fixture-supplier' });
      wx.removeStorageSync('ktv-session-admin-v1');
    });
    for (const [role, page, title] of [['customer', '/pages/customer/orders', '订单进度提醒'], ['supplier', '/pages/supplier/workbench', '接单提醒'], ['admin', '/pages/admin/index?scene=admin-notices', '商家订单提醒']]) {
      await m.reLaunch(page);
      if (role === 'admin') {
        await until(() => m.evaluate(() => require('common/store.js').connection.needsLogin), 'PC admin login gate');
        await m.evaluate(() => require('common/store.js').login('admin', 'fixture-password', 'admin'));
      }
      await until(async () => (await tree()).some(n => text(n).trim() === title), title);
      await tap('连接微信提醒'); await tap('授权接收微信提醒');
      await until(() => m.evaluate(role => getApp().__noticeState[role].credits === 1, role), role + ' accepted');
      await until(async () => (await tree()).some(n => text(n).includes('已授权，预计还可接收 1 条提醒')), role + ' state displayed');
      await m.screenshot({ path: path.resolve(output, role + '.png') }); checks.push(role + '-bound-and-subscribed');
    }
    assert.equal(await m.evaluate(() => getApp().__noticeCalls.filter(c => c.url === '/sessions/pc-admin').length), 1);
    await m.mockWxMethod('requestSubscribeMessage', { 'fixture-staff': 'reject', errMsg: 'requestSubscribeMessage:ok' });
    await tap('再订阅一次微信提醒'); await tap('授权接收微信提醒');
    await until(async () => (await tree()).some(n => text(n).includes('你未允许微信提醒')), 'deny message');
    assert.equal(await m.evaluate(() => getApp().__noticeState.admin.credits), 1); checks.push('denial-does-not-add-credit');
    await m.evaluate(() => { getApp().__noticeHoldBind = true; });
    await tap('再订阅一次微信提醒');
    await until(() => m.evaluate(() => !!getApp().__noticeFinishBind), 'held old admin bind');
    await m.reLaunch('/pages/customer/orders');
    await until(() => m.evaluate(() => require('common/store.js').connection.role === 'customer' && require('common/store.js').connection.ready), 'customer context');
    await m.evaluate(() => { getApp().__noticeHoldBind = false; getApp().__noticeFinishBind({ nonce: 'old-admin-nonce', templateId: 'fixture-staff' }); });
    await sleep(300);
    assert(!(await tree()).some(n => n.nodeName === 'button' && text(n).trim() === '授权接收微信提醒')); checks.push('old-account-bind-is-discarded');
    const counts = await m.evaluate(() => getApp().__noticeCalls.filter(c => c.url === '/notifications/subscribe').map(c => c.role));
    assert.deepEqual(counts, ['customer', 'supplier', 'admin', 'admin']);
    assert.deepEqual(await m.evaluate(() => getApp().__noticeUnexpected), []); assert.deepEqual(errors, []);
    const report = { nativeBuild: '1.0.8', checks, errors, transportMocked: true, realNotificationSent: false };
    fs.writeFileSync(path.resolve(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } finally {
    await m.evaluate(() => { const app = getApp(), s = require('common/store.js'); s.state.foreground = false; s.pauseSync(); if (app.__noticeOriginal) require('common/api.js').request = app.__noticeOriginal; for (const role of ['supplier', 'customer', 'admin']) wx.removeStorageSync('ktv-session-' + role + '-v1'); }).catch(() => {});
    await m.restoreWxMethod('login').catch(() => {}); await m.restoreWxMethod('requestSubscribeMessage').catch(() => {}); await m.disconnect();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
