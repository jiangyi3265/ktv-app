import test from "node:test";
import assert from "node:assert/strict";
import { roomScene, scannedScene, requireRoom, createRoomResolver } from "../common/room-entry.mjs";
const a = "a".repeat(32), b = "b".repeat(32);
test("generic trial entry cannot be mistaken for a room; launch source is not a room token", () => {
	assert.equal(roomScene({ scene: 1017, query: {} }), null);
	assert.equal(roomScene({}), null);
	assert.throws(() => requireRoom({ room: "", scene: "" }), /请先扫描包厢/);
	assert.throws(() => requireRoom({ room: "V01", scene: a, roomLoading: true }), /正在识别/);
});
test("cold and warm launch queries, scan paths and old web codes resolve the same room token", () => {
	assert.equal(roomScene({ scene: 1047, query: { scene: a } }), a);
	assert.equal(roomScene({ scene: b }), b);
	assert.equal(scannedScene({ path: "pages/index/index?scene=" + a }), a);
	assert.equal(scannedScene({ result: "https://chang.uuok.top/?scene=" + a }), a);
	assert.equal(roomScene({ q: encodeURIComponent("https://chang.uuok.top/?scene=" + b) }), b);
	assert.throws(() => roomScene({ scene: "%ZZ" }), /包厢码无效/);
	assert.throws(() => scannedScene({ result: "generic-experience-code" }), /通用体验码/);
	assert.throws(() => roomScene({ scene: "V01" }), /包厢码无效/);
});
test("latest scan wins and stale responses cannot send an order to a previous room", async () => {
	const pending = {}, state = { room: "V999", scene: a };
	const scan = createRoomResolver(state, (scene) => new Promise(resolve => pending[scene] = resolve), () => {});
	const first = scan(a), duplicate = scan(a);
	assert.equal(first, duplicate);
	const second = scan(b);
	assert.equal(state.room, "");
	assert.throws(() => requireRoom(state));
	await Promise.resolve();
	pending[b]({ room: "V02", scene: b });
	assert.equal(await second, true);
	pending[a]({ room: "V01", scene: a });
	assert.equal(await first, false);
	assert.equal(state.room, "V02");
	assert.equal(state.scene, b);
	requireRoom(state);
});
test("expired codes and network errors clear the previous room and allow retry", async () => {
	const state = { room: "V01", scene: a };
	let fails = true;
	const scan = createRoomResolver(state, async scene => {
		if (fails) throw new Error("包厢码已失效，请重新扫码");
		return { room: "V02", scene };
	}, () => {});
	await assert.rejects(scan(b), /已失效/);
	assert.equal(state.room, "");
	assert.equal(state.roomLoading, false);
	assert.throws(() => requireRoom(state));
	fails = false;
	assert.equal(await scan(b), true);
	assert.equal(state.room, "V02");
	await assert.rejects(scan(""), /包厢码无效/);
	assert.equal(state.roomLoading, false);
	assert.equal(await scan(b), true);
});
