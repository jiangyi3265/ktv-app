const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const origin = process.env.KTV_TEST_APP_ORIGIN || 'http://127.0.0.1:5189';
const output = process.env.KTV_TEST_OUTPUT || '.local/session-browser';
const gate = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const item = { id: 'chicken', name: '测试餐品', image: 'chicken', price: 32, quantity: 1, onSale: true, category: '主食', description: '会话隔离检查' };
const order = { id: '11', room: 'V01', status: 'pending', items: [item], paid: true, version: 2, time: '今天 12:00', events: [] };
const snapshot = (role, query) => ({ role, subject: role === 'supplier' ? 'A01' : 'guest', revision: 1, page: 1,
  products: role === 'customer' ? [item] : [], orders: role === 'supplier' ? [order] : [],
  orderDetail: query.get('orderId') === '11' && role === 'supplier' ? order : null,
  accounts: role === 'supplier' ? [{ id: 'A01', name: '测试食堂', enabled: true, process: true, deliver: true }] : [],
  rooms: [], orderCounts: { pending: role === 'supplier' ? 1 : 0 }, orderAlerts: [], hasMore: false, demoPayment: false, wechatPayment: false });
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch(), results = [];
  try {
    for (const name of ['logout-immediate', 'logout-role-isolation', 'login-role-isolation', 'expired-session-stays-closed']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage(), errors = [], unexpected = [], held = [];
      page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
      let holdLogin = false, holdLogout = false, stateMode = 'normal', heldState;
      const waitFor = async fn => { const end = Date.now() + 5000; while (!fn()) { assert(Date.now() < end, 'Expected request was not observed'); await page.waitForTimeout(20); } };
      const screen = () => page.locator('.phone-screen:visible').last();
      const button = text => screen().locator('uni-button').filter({ hasText: new RegExp('^\\s*' + text + '\\s*$') });
      const navigate = id => page.locator('.review-link:visible').filter({ hasText: new RegExp('^' + id) }).click();
      await page.route('**/ktv-api/**', async route => {
        const url = new URL(route.request().url()), p = url.pathname.split('/ktv-api')[1];
        const token = await route.request().headerValue('x-ktv-token') || '';
        const role = token.includes('supplier') ? 'supplier' : 'customer';
        if (p === '/sessions/customer') return route.fulfill({ json: { token: 'fixture-customer', recovery: 'fixture-recovery', role: 'customer' } });
        if (p === '/sessions/staff') {
          if (holdLogin) { const job = gate(); held.push(job); await job.promise; }
          return route.fulfill({ json: { token: 'fixture-supplier', role: 'supplier' } });
        }
        if (p === '/session') {
          if (holdLogout) { const job = gate(); held.push(job); await job.promise; }
          return route.fulfill({ json: { ok: true } });
        }
        if (p === '/notifications/status') return route.fulfill({ json: { enabled: false, bound: false, credits: 0, templateReady: false } });
        if (p === '/state') {
          if (role === 'supplier' && stateMode === 'hold-first') {
            stateMode = 'expire-new'; heldState = gate(); held.push(heldState); await heldState.promise;
            return route.fulfill({ json: snapshot(role, url.searchParams) });
          }
          if (role === 'supplier' && stateMode === 'expire-new') return route.fulfill({ status: 401, json: { message: '测试会话已失效，请重新登录' } });
          return route.fulfill({ json: snapshot(role, url.searchParams) });
        }
        unexpected.push(p); return route.fulfill({ status: 503, json: { message: 'Test blocked an unexpected business request' } });
      });
      try {
        await page.goto(origin + '/#/pages/index/index'); await screen().locator('.catalog-product').waitFor();
        await navigate('09'); await screen().locator('.connection-gate input').first().fill('A01');
        await screen().locator('.connection-gate input').nth(1).fill('fixture-password');
        if (name === 'login-role-isolation') holdLogin = true;
        await button('登录').click();
        if (name === 'login-role-isolation') {
          await waitFor(() => held.length === 1); await navigate('01'); await screen().locator('.catalog-product').waitFor();
          holdLogin = false; held[0].resolve(); await page.waitForTimeout(600);
          assert.equal(await screen().locator('.catalog-product').count(), 1, 'Late staff login replaced the active customer catalog');
        } else {
          await screen().locator('.supplier-order').waitFor();
          if (name === 'expired-session-stays-closed') {
            stateMode = 'hold-first'; await waitFor(() => heldState);
            await screen().locator('.supplier-order uni-button').last().click();
            await screen().locator('.connection-gate').waitFor();
            heldState.resolve(); await page.waitForTimeout(400);
            assert.equal(await screen().locator('.connection-gate').count(), 1, 'A late success reopened the expired staff session');
            assert.equal(await screen().locator('.page-scroll').count(), 0);
          } else {
            holdLogout = true; await button('退出账号').click(); await waitFor(() => held.length === 1);
            if (name === 'logout-immediate') {
              await page.waitForTimeout(150);
              assert.equal(await screen().locator('.connection-gate').count(), 1, 'Logout still exposed staff orders while waiting for the server');
            } else {
              await navigate('01'); await screen().locator('.catalog-product').waitFor();
              holdLogout = false; held[0].resolve(); await page.waitForTimeout(500);
              assert.equal(await screen().locator('.catalog-product').count(), 1, 'Late logout switched the customer page to staff login');
            }
          }
        }
        assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
        results.push({ name, passed: true });
      } catch (e) { results.push({ name, passed: false, error: e.message }); }
      finally {
        await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
        holdLogin = false; holdLogout = false; for (const job of held) job.resolve();
        await page.waitForTimeout(100); await context.close();
        console.log(JSON.stringify(results.at(-1)));
      }
    }
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ results, transportMocked: true, productionBusinessWrites: false }, null, 2));
    assert(results.every(r => r.passed), 'Session browser regression failed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
