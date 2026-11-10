// App's numeric scene is a launch source; only query.scene identifies a room.
function decode(value) {
	try { return decodeURIComponent(value); }
	catch { throw new Error("包厢码无效，请重新扫描包厢专属码"); }
}
function fromPath(value) {
	if (typeof value !== "string") return null;
	const match = value.match(/[?&]scene=([^&#]*)/);
	return match ? decode(match[1]) : null;
}
export function roomScene(options = {}) {
	const query = options.query || options;
	let scene = typeof query.scene === "string" ? decode(query.scene) : null;
	if (scene === null && query.q) scene = fromPath(decode(query.q));
	if (scene === null) return null;
	if (!/^[a-f0-9]{32}$/.test(scene))
		throw new Error("包厢码无效，请重新扫描包厢专属码");
	return scene;
}
export function scannedScene(result) {
	const scene = fromPath(result.path) || fromPath(result.result);
	if (!scene) throw new Error("请扫描包厢专属点餐码，通用体验码不包含包厢号");
	return roomScene({ scene });
}
export function requireRoom(state) {
	if (state.roomLoading) throw new Error("正在识别包厢，请稍候");
	if (!state.room || !/^[a-f0-9]{32}$/.test(state.scene || ""))
		throw new Error("请先扫描包厢专属点餐码");
}
// The most recent scan wins even when older network responses arrive later.
export function createRoomResolver(state, resolve, persist) {
	let sequence = 0, pending;
	return function scan(scene) {
		if (pending?.scene === scene) return pending.promise;
		const epoch = ++sequence;
		state.room = "";
		state.scene = "";
		state.roomLoading = true;
		persist();
		const promise = Promise.resolve().then(async () => {
			try {
				const validScene = roomScene({ scene });
				if (!validScene) throw new Error("请先扫描包厢专属点餐码");
				const result = await resolve(validScene);
				if (epoch !== sequence) return false;
				if (!result.room || result.scene !== validScene) throw new Error("包厢识别失败，请重新扫码");
				state.room = result.room;
				state.scene = result.scene;
				persist();
				return true;
			} catch (error) {
				if (epoch === sequence) throw error;
				return false;
			} finally {
				if (epoch === sequence) { state.roomLoading = false; pending = null; }
			}
		});
		pending = { scene, promise };
		return promise;
	};
}
