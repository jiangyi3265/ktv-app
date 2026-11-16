const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const appOrigin = process.env.KTV_TEST_APP_ORIGIN || 'http://127.0.0.1:5189';
const pcOrigin = process.env.KTV_PC_URL || 'http://127.0.0.1:5190';
const output = process.env.KTV_TEST_OUTPUT || '.local/notifications-browser';
const snapshot = role => ({ role, subject: role === 'admin' ? 'pc-1' : role === 'supplier' ? 'A01' : 'wx-fixture', revision: 1, page: 1,
  products: [], orders: [], rooms: [], accounts: role === 'supplier' ? [{ id: 'A01', name: '测试食堂', enabled: true, process: true, deliver: true }] : [],
  orderDetail: null, orderCounts: {}, orderAlerts: [], hasMore: false, demoPayment: false, wechatPayment: true });
(async () => {
  await fs.mkdir(output, { recursive: true }); const browser = await chromium.launch();
  const errors = [], unexpected = [], checks = [], saves = []; let pcBearerSeen = false;
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', e => errors.push(e.message)); page.setDefaultTimeout(15000);
    await page.route('**/ktv-api/**', async route => {
      const request = route.request(), url = new URL(request.url()), p = url.pathname.split('/ktv-api')[1];
      const auth = await request.headerValue('authorization'), opaque = await request.headerValue('x-ktv-token');
      const role = auth === 'Bearer fixture-pc' ? 'admin' : opaque === 'fixture-supplier' ? 'supplier' : 'customer';
      if (auth) { assert.equal(opaque, null); pcBearerSeen = true; }
      const respond = json => route.fulfill({ json });
      if (p === '/sessions/customer') return respond({ role: 'customer', token: 'fixture-customer', recovery: 'fixture-recovery' });
      if (p === '/sessions/pc-admin') { assert.equal(request.postDataJSON().username, 'admin'); return respond({ role: 'admin', token: 'pc.fixture-pc' }); }
      if (p === '/sessions/staff') return respond({ role: 'supplier', token: 'fixture-supplier' });
      if (p === '/session') return respond({ ok: true });
      if (p === '/state') return respond(snapshot(role));
      if (p === '/notifications/status') return respond({ enabled: true, templateReady: true, templateId: 'fixture-template', bound: false, credits: 0, overdueMinutes: 5 });
      unexpected.push(p); return route.fulfill({ status: 503, json: { message: 'Unexpected mocked request' } });
    });
    const screen = () => page.locator('.phone-screen:visible').last();
    const button = text => screen().locator('uni-button').filter({ hasText: new RegExp('^\\s*' + text + '\\s*$') });
    await page.goto(appOrigin + '/#/pages/customer/orders');
    await screen().getByText('订单进度提醒', { exact: true }).waitFor();
    await screen().getByText('尚未连接微信提醒。', { exact: true }).waitFor();
    await button('商家管理').click(); await screen().getByText('电脑后台管理员登录', { exact: true }).waitFor();
    await screen().locator('.connection-gate input').first().fill('admin'); await screen().locator('.connection-gate input').nth(1).fill('fixture-password'); await button('登录').click();
    await screen().getByText('商家订单提醒', { exact: true }).waitFor(); assert(pcBearerSeen);
    await page.screenshot({ path: path.join(output, 'merchant-mobile.png'), fullPage: true }); checks.push('shared-pc-login');
    await button('退出账号').click(); await button('返回顾客点餐').waitFor();
    await page.goto(appOrigin + '/#/pages/customer/orders'); await button('食堂登录').click();
    await screen().locator('.connection-gate input').first().fill('A01'); await screen().locator('.connection-gate input').nth(1).fill('fixture-password'); await button('登录').click();
    await screen().getByText('接单提醒', { exact: true }).waitFor(); checks.push('supplier-entry');
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 932 }); await page.goto(appOrigin + '/#/pages/customer/orders');
      await screen().getByText('订单进度提醒', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: path.join(output, 'customer-' + width + '.png'), fullPage: true }); checks.push('customer-width-' + width);
    }
    await page.close();
    const pc = await browser.newPage({ viewport: { width: 1280, height: 1000 } }); pc.setDefaultTimeout(20000); pc.on('pageerror', e => errors.push(e.message));
    await pc.route('**/dev-api/**', async route => {
      const request = route.request(), p = new URL(request.url()).pathname.split('/dev-api')[1], respond = json => route.fulfill({ json });
      if (p === '/captchaImage') return respond({ code: 200, captchaEnabled: false });
      if (p === '/login') return respond({ code: 200, token: 'fixture-pc' });
      if (p === '/getInfo') return respond({ code: 200, user: { userId: 1, userName: 'admin', nickName: '测试管理员' }, roles: ['admin'], permissions: ['*:*:*'] });
      if (p === '/getRouters') return respond({ code: 200, data: [] });
      if (p === '/ktv-api/state') return respond(snapshot('admin'));
      if (p === '/ktv-api/readiness') return respond({ wechatLogin: true, wechatPayment: true });
      if (p === '/ktv-api/notifications/admin') return respond({ enabled: true, encryptionReady: true, template: { title: '商家订单任务提醒' }, customerTemplate: {}, targets: [{ scope: 'admin:pc-1', name: '当前管理员', bound: false, credits: 0 }], deliveries: [{ id: 1, order_id: '11', scope: 'customer', kind: 'accepted', channel: 'wechat', status: 'waiting', error_code: 'SUBSCRIPTION_REQUIRED' }] });
      if (p === '/ktv-api/notifications/admin-entry') return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ9kAAAAASUVORK5CYII=', 'base64') });
      if (p === '/ktv-api/notifications/templates') return respond({ data: [{ priTmplId: 'customer-fixture', title: '订单状态通知', type: 2, content: '状态：{{phrase1.DATA}}\n包厢：{{thing2.DATA}}' }] });
      if (p === '/ktv-api/notifications/config') { saves.push(request.postDataJSON()); return respond({ ok: true }); }
      unexpected.push(p); return route.fulfill({ status: 503, json: { message: 'Unexpected mocked request' } });
    });
    await pc.goto(pcOrigin + '/login'); await pc.getByPlaceholder('账号').fill('admin'); await pc.getByPlaceholder('密码').fill('fixture-password');
    await pc.getByRole('button', { name: /登\s*录/ }).click(); await pc.getByRole('heading', { name: '包厢餐食工作台' }).waitFor();
    await pc.getByRole('tab', { name: '接单通知', exact: true }).click();
    await pc.getByRole('button', { name: '显示管理员小程序码', exact: true }).click(); await pc.getByAltText('使用微信扫描，进入小程序管理员登录').waitFor();
    await pc.getByRole('button', { name: '选择或更新微信模板' }).click();
    await pc.getByText('顾客订单进度', { exact: true }).click(); await pc.locator('.notice-panel .notice-config .el-select').first().click(); await pc.getByRole('option', { name: '订单状态通知' }).click();
    await pc.getByRole('button', { name: '保存微信通知模板', exact: true }).click();
    await pc.getByText('通知配置已保存', { exact: true }).waitFor(); assert.equal(saves.at(-1).scope, 'customer-template');
    assert.equal(saves.at(-1).fields.phrase1, 'status'); checks.push('pc-entry-and-customer-template');
    assert.equal(await pc.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await pc.screenshot({ path: path.join(output, 'pc-notifications.png'), fullPage: true });
    assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
    const report = { checks, mockedTransport: true, realMessagesSent: false, errors, unexpected };
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } catch (error) { for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); throw error; } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
