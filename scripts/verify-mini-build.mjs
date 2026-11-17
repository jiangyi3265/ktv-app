import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { miniApiOrigin } from "./mini-config.mjs";

// Exercise the compiled API module; source-only and mocked page tests cannot catch an empty build-time origin.
export async function verifyMiniBuild(directory, expectedOrigin) {
	const origin = miniApiOrigin(expectedOrigin), calls = [], exports = {};
	const uni = {
		request(options) { calls.push(options); options.success({ statusCode: 200, data: { ok: true } }); },
		uploadFile(options) { calls.push(options); options.success({ statusCode: 200, data: '{"url":"/fixture.png"}' }); },
	};
	const source = await fs.readFile(path.join(directory, "common/api.js"), "utf8");
	vm.runInNewContext(source, { exports, require(name) {
		assert.equal(name, "./vendor.js"); return { index: uni };
	} }, { timeout: 1000 });
	assert.equal(exports.apiUrl("/ktv-api/notifications/status"), origin + "/ktv-api/notifications/status", "小程序构建产物的服务器地址错误");
	await exports.request("/notifications/status", { token: "pc.fixture-admin" });
	await exports.request("/notifications/subscribe", { method: "POST", token: "fixture-supplier", data: { accepted: true } });
	await exports.uploadImage("/fixture.png", "pc.fixture-admin");
	assert.equal(calls[0].url, origin + "/ktv-api/notifications/status");
	assert.equal(calls[0].header.Authorization, "Bearer fixture-admin");
	assert.equal(calls[1].url, origin + "/ktv-api/notifications/subscribe");
	assert.equal(calls[1].header["X-KTV-Token"], "fixture-supplier");
	assert.equal(calls[2].url, origin + "/ktv-api/images");
	return { origin, requestsVerified: calls.length };
}
