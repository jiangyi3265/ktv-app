import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
const source = await readFile(new URL('../common/api.js', import.meta.url), 'utf8');
function transport() {
  const requests = [], exports = {};
  const context = { module: { exports }, exports, uni: {
    request: options => { requests.push(options); options.success({ statusCode: 200, data: { ok: true } }); },
    uploadFile: options => { requests.push(options); options.success({ statusCode: 200, data: JSON.stringify({ url: '/fixture.png' }) }); },
  } };
  vm.runInNewContext(transformSync(source, { format: 'cjs', define: { 'import.meta.env': '{}' } }).code, context);
  return { api: context.module.exports, requests };
}
test('PC sessions use Bearer authentication for both API calls and image uploads', async () => {
  const { api, requests } = transport();
  await api.request('/notifications/status', { token: 'pc.fixture-jwt' });
  await api.uploadImage('/fixture.png', 'pc.fixture-jwt');
  for (const request of requests) { assert.equal(request.header.Authorization, 'Bearer fixture-jwt'); assert.equal(request.header['X-KTV-Token'], undefined); }
});
test('Customer and supplier sessions keep opaque authentication and anonymous calls omit it', async () => {
  const { api, requests } = transport();
  await api.request('/state', { token: 'fixture-supplier' }); await api.request('/sessions/customer');
  assert.equal(requests[0].header['X-KTV-Token'], 'fixture-supplier'); assert.equal(requests[0].header.Authorization, undefined);
  assert.equal(requests[1].header.Authorization, undefined); assert.equal(requests[1].header['X-KTV-Token'], undefined);
});
