import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

function navigation(stack = [], failBack = false) {
  const calls = [], exports = {};
  const context = { exports, module: { exports }, getCurrentPages: () => stack, uni: {
    reLaunch: options => { calls.push(['reLaunch', options.url]); options.complete(); },
    navigateBack: options => { calls.push(['navigateBack']); if (failBack) options.fail(); else options.success(); },
  } };
  vm.runInNewContext(transformSync(readFileSync(new URL('../common/pages.js', import.meta.url), 'utf8'), { format: 'cjs' }).code, context);
  return { api: context.module.exports, calls, context };
}

test('Every registered page has a different, registered fallback in open and closed mode', () => {
  const { api } = navigation();
  const registered = JSON.parse(readFileSync(new URL('../pages.json', import.meta.url), 'utf8')).pages;
  assert.equal(api.designPages.length, registered.length);
  for (const page of registered) {
    const item = api.designPages.find(p => p.path === page.path);
    assert(item, page.path);
    for (const enabled of [true, false]) {
      const destination = api.returnNavigation(item.id, enabled);
      assert.notEqual(destination.target, item.id);
      assert(api.designPages.some(p => p.id === destination.target));
      if (!enabled) assert(!['01', '02', '03', '04'].includes(destination.target));
    }
  }
});

test('Detail back preserves the previous page and its query/filter state', () => {
  const { api, calls } = navigation([{ route: 'pages/admin/orders', options: { status: 'paid', page: 2 } }, { route: 'pages/admin/order-detail' }]);
  const nav = api.returnNavigation('19', true);
  api.back(nav.target, { root: nav.root });
  assert.deepEqual(calls, [['navigateBack']]);
});

test('Cold notification entry and failed native back reset to the correct workspace', () => {
  for (const [stack, fails] of [[[{ route: 'pages/supplier/detail' }], false], [[{}, {}], true]]) {
    const { api, calls } = navigation(stack, fails);
    api.back('09');
    assert.deepEqual(calls.at(-1), ['reLaunch', '/pages/supplier/workbench']);
    assert.equal(calls.length, fails ? 2 : 1);
  }
});

test('Payment result and order-list return never reopen stale payment/history screens', () => {
  const { api, calls } = navigation([{ route: 'pages/customer/payment' }, { route: 'pages/customer/success' }]);
  for (const page of ['05', '06']) {
    const nav = api.returnNavigation(page, true);
    api.back(nav.target, { root: nav.root });
  }
  assert.deepEqual(calls, [['reLaunch', '/pages/customer/orders'], ['reLaunch', '/pages/index/index']]);
});

test('Double taps do not pop more than one page while navigation is in progress', () => {
  const { api, calls, context } = navigation([{}, {}, {}]);
  let complete;
  context.uni.navigateBack = options => { calls.push(['navigateBack']); complete = options.success; };
  api.back('18'); api.back('18');
  assert.equal(calls.length, 1);
  complete(); api.back('18');
  assert.equal(calls.length, 2);
});
