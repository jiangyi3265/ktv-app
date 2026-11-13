import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { transformSync } from 'esbuild';
import * as vue from 'vue';
import * as domain from '../common/domain.mjs';
import * as roomEntry from '../common/room-entry.mjs';

// Exercise the real store in separate runtimes, with H5/WeChat compile branches
// and controlled transport timing. No server, real tokens or business writes.
const source = await readFile(new URL('../common/live-store.js', import.meta.url), 'utf8');
function platformSource(platform) {
  const stack = [true];
  return source.split('\n').filter(line => {
    const directive = line.match(/^\s*\/\/\s*#(ifdef|ifndef|endif)\s*(\S*)/);
    if (!directive) return stack.at(-1);
    if (directive[1] === 'endif') stack.pop();
    else stack.push(stack.at(-1) && ((directive[2] === platform) === (directive[1] === 'ifdef')));
    return false;
  }).join('\n');
}
function fixture(role, extra = {}) {
  return { role, subject: role === 'supplier' ? 'A01' : 'customer-fixture', revision: 1, page: 1,
    products: [], orders: [], rooms: [], accounts: [], orderDetail: null,
    orderCounts: {}, orderAlerts: [], hasMore: false, ...extra };
}
function runtime(platform) {
  const storage = new Map([['ktv-customer-recovery', 'fixture-recovery']]);
  const jobs = [];
  const transport = (path, options) => new Promise((resolve, reject) => jobs.push({ path, options, resolve, reject, used: false }));
  const exports = {};
  const context = {
    exports, module: { exports }, console,
    setTimeout: () => 1, clearTimeout: () => {},
    uni: { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key), login: ({ success }) => success({ code: 'fixture-wx-code' }) },
    require: id => ({ vue, './api': { request: transport, uploadImage: transport }, './domain.mjs': domain, './room-entry.mjs': roomEntry })[id],
  };
  vm.runInNewContext(transformSync(platformSource(platform), { format: 'cjs', target: 'es2020' }).code, context);
  const store = context.module.exports;
  const token = (role, value = 'fixture-' + role) => storage.set('ktv-session-' + role + '-v1', { token: value, role });
  const next = async predicate => {
    for (let i = 0; i < 100; i++) { const job = jobs.find(x => !x.used && predicate(x)); if (job) { job.used = true; return job; } await Promise.resolve(); }
    throw Error('Expected transport request missing');
  };
  const stateRequest = () => next(x => x.path.startsWith('/state?'));
  const boot = async (role, data = fixture(role)) => { token(role); const task = store.activate(role); (await stateRequest()).resolve(data); await task; };
  const drain = async task => {
    let done = false, failure; task.then(() => { done = true; }, e => { failure = e; done = true; });
    for (let i = 0; i < 200 && !done; i++) {
      for (const job of jobs.filter(x => !x.used)) {
        job.used = true;
        if (job.path.startsWith('/state?')) job.resolve(fixture(job.options.token.includes('supplier') ? 'supplier' : 'customer'));
        else if (job.path === '/session') job.resolve({ ok: true });
        else throw Error('Unexpected transport request: ' + job.path);
      }
      await Promise.resolve();
    }
    assert(done, 'Store operation did not settle'); if (failure) throw failure;
  };
  return { store, storage, jobs, token, next, stateRequest, boot, drain };
}

for (const platform of ['H5', 'MP-WEIXIN']) {
  test(platform + ': late success cannot restore an invalidated login', async () => {
    const r = runtime(platform); await r.boot('supplier');
    const old = r.store.refresh(), oldRequest = await r.stateRequest();
    const newest = r.store.refresh(), fresh = await r.stateRequest();
    fresh.reject(Object.assign(Error('会话已失效'), { status: 401 })); await newest.catch(() => {});
    assert.equal(r.store.connection.ready, false);
    oldRequest.resolve(fixture('supplier', { orders: [{ id: 'old-order' }] })); await old;
    assert.equal(r.store.connection.ready, false, 'Late response restored an expired staff screen');
    assert.equal(r.store.state.orders.length, 0);
    assert.equal(r.store.state.orderDetail, null);
  });
  test(platform + ': old filter error cannot invalidate a newer successful query', async () => {
    const r = runtime(platform); await r.boot('supplier');
    const old = r.store.refresh(), oldRequest = await r.stateRequest();
    const filtered = r.store.setOrderFilter('supplier', { filter: 'completed' });
    (await r.stateRequest()).resolve(fixture('supplier')); await filtered;
    oldRequest.reject(Object.assign(Error('旧查询失败'), { status: 503 })); await old.catch(() => {});
    assert.equal(r.store.connection.offline, false, 'An obsolete filter error blocked current operations');
  });
  test(platform + ': order detail follows the current requested order', async () => {
    const r = runtime(platform); await r.boot('supplier'); r.store.state.activeOrderId = '11';
    const old = r.store.refresh(), oldRequest = await r.stateRequest();
    r.store.state.activeOrderId = '22'; const fresh = r.store.refresh();
    (await r.stateRequest()).resolve(fixture('supplier', { orderDetail: { id: '22' } })); await fresh;
    oldRequest.resolve(fixture('supplier', { orderDetail: { id: '11' } })); await old;
    assert.equal(r.store.activeOrder.value.id, '22', 'Previous detail replaced the current order');
  });
  test(platform + ': logout clears local staff data before a slow server reply', async () => {
    const r = runtime(platform); await r.boot('supplier', fixture('supplier', { orderDetail: { id: '11' }, orderCounts: { pending: 1 }, orderAlerts: [{ id: '11' }] }));
    const out = r.store.logout(), pending = await r.next(x => x.path === '/session');
    try {
      assert.equal(r.store.connection.ready, false, 'Staff data remained visible while logout waited');
      assert.equal(r.store.state.orderDetail, null);
      assert.equal(Object.keys(r.store.state.orderCounts).length, 0);
      assert.equal(r.store.state.orderAlerts.length, 0);
    } finally { pending.resolve({ ok: true }); await out; }
  });
  test(platform + ': late logout reply cannot switch a customer page back to staff', async () => {
    const r = runtime(platform); await r.boot('supplier');
    const out = r.store.logout(), pending = await r.next(x => x.path === '/session');
    await r.boot('customer'); pending.resolve({ ok: true }); await out;
    assert.equal(r.store.connection.role, 'customer'); assert.equal(r.store.connection.ready, true);
  });
  test(platform + ': login response after leaving its page cannot change the active role', async () => {
    const r = runtime(platform); await r.store.activate('supplier');
    const login = r.store.login('A01', 'fixture-password', 'supplier');
    const pending = await r.next(x => x.path === '/sessions/staff');
    await r.boot('customer'); pending.resolve({ role: 'supplier', token: 'fixture-supplier-new' });
    await r.drain(login);
    assert.equal(r.store.connection.role, 'customer');
    assert.equal(r.storage.has('ktv-session-supplier-v1'), false);
  });
  test(platform + ': old-token error cannot remove a newly logged-in session', async () => {
    const r = runtime(platform); await r.boot('supplier');
    const old = r.store.refresh(), pending = await r.stateRequest();
    const login = r.store.login('A01', 'fixture-password', 'supplier');
    (await r.next(x => x.path === '/sessions/staff')).resolve({ role: 'supplier', token: 'fixture-supplier-new' });
    await r.drain(login);
    pending.reject(Object.assign(Error('旧会话失效'), { status: 401 })); await old.catch(() => {});
    assert.equal(r.storage.get('ktv-session-supplier-v1')?.token, 'fixture-supplier-new');
    assert.equal(r.store.connection.ready, true);
  });
  test(platform + ': expired customer login leaves a usable reconnect action', async () => {
    const r = runtime(platform); r.token('customer');
    const boot = r.store.activate('customer');
    (await r.stateRequest()).reject(Object.assign(Error('会话过期'), { status: 401 })); await boot;
    assert.equal(r.store.connection.ready, false); assert.equal(r.store.connection.loading, false);
    const retry = r.store.activate('customer');
    (await r.next(x => x.path === (platform === 'H5' ? '/sessions/customer' : '/sessions/wechat'))).resolve({ role: 'customer', token: 'fixture-customer-new' });
    (await r.stateRequest()).resolve(fixture('customer')); await retry;
    assert.equal(r.store.connection.ready, true);
  });
  test(platform + ': superseded customer bootstrap cannot overwrite stored identity', async () => {
    const r = runtime(platform); const boot = r.store.activate('customer');
    const pending = await r.next(x => x.path === (platform === 'H5' ? '/sessions/customer' : '/sessions/wechat'));
    await r.store.activate('supplier');
    pending.resolve({ role: 'customer', token: 'fixture-customer-old', recovery: 'fixture-old-recovery' });
    await r.drain(boot);
    assert.equal(r.store.connection.role, 'supplier'); assert.equal(r.store.connection.needsLogin, true);
    assert.equal(r.storage.has('ktv-session-customer-v1'), false);
    assert.equal(r.storage.get('ktv-customer-recovery'), 'fixture-recovery');
  });
  test(platform + ': an old write cannot unlock or refresh another session', async () => {
    const r = runtime(platform); await r.boot('supplier');
    const old = r.store.updateOrder('11', 'preparing', ['chicken']); old.catch(() => {});
    const first = await r.next(x => x.path === '/orders/11/accept');
    await r.boot('customer');
    const next = r.store.cancelOrder('22'); const second = await r.next(x => x.path === '/orders/22/cancel');
    first.resolve({ id: '11' });
    await assert.rejects(old, /页面或账号已切换/);
    assert.equal(r.store.connection.pending, true, 'Old write released the new account’s pending lock');
    second.resolve({ id: '22' }); (await r.stateRequest()).resolve(fixture('customer')); await next;
    assert.equal(r.store.connection.pending, false);
  });
  test(platform + ': switching accounts during post-save refresh discards the old result', async () => {
    const r = runtime(platform); await r.boot('supplier');
    const write = r.store.updateOrder('11', 'preparing', ['chicken']); write.catch(() => {});
    (await r.next(x => x.path === '/orders/11/accept')).resolve({ id: '11' });
    const refresh = await r.stateRequest(); await r.boot('customer');
    refresh.resolve(fixture('supplier'));
    await assert.rejects(write, /页面或账号已切换/);
    assert.equal(r.store.connection.role, 'customer'); assert.equal(r.store.connection.ready, true);
  });
}
