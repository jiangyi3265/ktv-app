import { reactive, computed } from "vue";
import { request, uploadImage } from "./api";
import { money, totalCents, setQuantity } from "./domain.mjs";
const LOCAL_KEY = "ktv-local-v1",
	local = uni.getStorageSync(LOCAL_KEY) || {};
export const state = reactive({
	customerId: "",
	supplierId: "",
	room: local.room || "A08",
	cart: local.cart || {},
	products: [],
	orders: [],
	rooms: [],
	accounts: [],
	foreground: true,
	activeOrderId: local.activeOrderId || "",
	selectedRoom: local.selectedRoom || "A08",
	selectedProduct: local.selectedProduct || "chicken",
	selectedAccount: local.selectedAccount || "A01",
	sound: local.sound !== false,
});
export const connection = reactive({
	role: "",
	ready: false,
	loading: false,
	needsLogin: false,
	error: "",
	offline: false,
	pending: false,
	demoPayment: false,
});
let revision = -1,
	generation = 0,
	timer,
	boot;
const sessionKey = (role) => `ktv-session-${role}-v1`;
const session = (role) => uni.getStorageSync(sessionKey(role)) || null;
export function persist() {
	const saved = {};
	for (const key of [
		"room",
		"cart",
		"activeOrderId",
		"selectedRoom",
		"selectedProduct",
		"selectedAccount",
		"sound",
	])
		saved[key] = state[key];
	uni.setStorageSync(LOCAL_KEY, JSON.parse(JSON.stringify(saved)));
}
function apply(data, role, epoch) {
	if (
		epoch !== generation ||
		role !== connection.role ||
		data.revision < revision
	)
		return;
	revision = data.revision;
	for (const key of ["products", "orders", "rooms", "accounts"])
		state[key] = data[key];
	if (role === "customer") state.customerId = data.subject;
	if (role === "supplier") state.supplierId = data.subject;
	connection.demoPayment = data.demoPayment;
	connection.ready = true;
	connection.needsLogin = false;
	connection.error = "";
	connection.offline = false;
}
function handleError(error, role, epoch) {
	if (epoch !== generation || role !== connection.role) return;
	connection.error = error.message;
	connection.offline = true;
	if (error.status === 401 || error.status === 403) {
		uni.removeStorageSync(sessionKey(role));
		connection.ready = false;
		connection.needsLogin = role !== "customer";
		for (const key of ["products", "orders", "rooms", "accounts"])
			state[key] = [];
	}
}
export async function refresh() {
	const role = connection.role,
		epoch = generation,
		current = session(role);
	if (!current) throw new Error("请先登录");
	try {
		const data = await request("/state", { token: current.token });
		apply(data, role, epoch);
		return data;
	} catch (error) {
		handleError(error, role, epoch);
		throw error;
	}
}
function schedule() {
	clearTimeout(timer);
	if (!state.foreground || connection.needsLogin) return;
	timer = setTimeout(
		async () => {
			try {
				await refresh();
			} catch {
			} finally {
				schedule();
			}
		},
		connection.offline ? 4000 : 1000,
	);
}
export function pauseSync() {
	clearTimeout(timer);
}
export function activate(role) {
	if (connection.role === role && boot) return boot;
	if (connection.role === role && connection.ready) {
		schedule();
		return refresh().catch(() => {});
	}
	clearTimeout(timer);
	const epoch = ++generation;
	connection.role = role;
	connection.loading = true;
	connection.ready = false;
	connection.error = "";
	connection.needsLogin = false;
	revision = -1;
	for (const key of ["products", "orders", "rooms", "accounts"])
		state[key] = [];
	boot = Promise.resolve().then(async () => {
		try {
			let current = session(role);
			if (!current && role === "customer") {
				current = await request("/sessions/customer", {
					method: "POST",
				});
				uni.setStorageSync(sessionKey(role), current);
			}
			if (!current) {
				connection.needsLogin = true;
				return;
			}
			if (epoch !== generation) return;
			await refresh();
		} catch (error) {
			handleError(error, role, epoch);
		} finally {
			if (epoch === generation) {
				connection.loading = false;
				boot = null;
				schedule();
			}
		}
	});
	return boot;
}
export async function login(username, password, role = connection.role) {
	const current = await request("/sessions/staff", {
		method: "POST",
		data: { username, password },
	});
	if (current.role !== role) {
		await request("/session", { method: "DELETE", token: current.token });
		throw new Error(
			role === "admin" ? "请使用 KTV 管理员账号" : "请使用食堂账号",
		);
	}
	uni.setStorageSync(sessionKey(role), current);
	boot = null;
	await activate(role);
	if (!connection.ready) throw new Error(connection.error || "登录失败");
}
export async function logout() {
	const role = connection.role,
		current = session(role);
	if (current)
		await request("/session", { method: "DELETE", token: current.token });
	uni.removeStorageSync(sessionKey(role));
	connection.ready = false;
	await activate(role);
}
async function mutate(path, method, data) {
	if (!connection.ready || connection.offline)
		throw new Error("服务未连接，请重试后再操作");
	if (connection.pending) throw new Error("上一项操作正在保存，请稍候");
	connection.pending = true;
	const current = session(connection.role);
	try {
		const result = await request(path, {
			method,
			data,
			token: current.token,
		});
		await refresh();
		return result;
	} catch (error) {
		if (error.status) {
			try {
				await refresh();
			} catch {}
		}
		throw error;
	} finally {
		connection.pending = false;
	}
}
export const cartItems = computed(() =>
	state.products
		.filter((p) => p.onSale && state.cart[p.id])
		.map((p) => ({ ...p, quantity: state.cart[p.id] })),
);
export const cartCount = computed(() =>
	cartItems.value.reduce((n, item) => n + item.quantity, 0),
);
export const cartTotal = computed(() => money(totalCents(cartItems.value)));
export function changeQuantity(id, delta) {
	state.cart = setQuantity(state.cart, id, (state.cart[id] || 0) + delta);
	persist();
}
export function clearCart() {
	state.cart = {};
	persist();
}
export const orderTotal = (order) =>
	money(order.totalCents ?? totalCents(order.items));
export const orderCount = (order) =>
	order.items.reduce((n, item) => n + item.quantity, 0);
export const emptyOrder = {
	id: "",
	room: "",
	status: "unpaid",
	paid: false,
	items: [],
	time: "",
	events: [],
};
export const activeOrder = computed(
	() =>
		state.orders.find((o) => o.id === state.activeOrderId) ||
		state.orders[0] ||
		emptyOrder,
);
export const visibleSupplierOrders = computed(() =>
	connection.role === "supplier" ? state.orders : [],
);
export async function createUnpaidOrder() {
	if (!cartItems.value.length) throw new Error("请先选择餐品");
	const items = cartItems.value.map(({ id, quantity }) => ({ id, quantity })),
		fingerprint = JSON.stringify({ room: state.room, items });
	let draft = uni.getStorageSync("ktv-create-request");
	if (draft?.fingerprint !== fingerprint) {
		draft = {
			fingerprint,
			key: Date.now() + "-" + Math.random().toString(36).slice(2),
		};
		uni.setStorageSync("ktv-create-request", draft);
	}
	const result = await mutate("/orders", "POST", {
		room: state.room,
		items,
		requestKey: draft.key,
	});
	state.activeOrderId = result.id;
	persist();
	uni.removeStorageSync("ktv-create-request");
	return state.orders.find((o) => o.id === result.id);
}
export function updateOrder(id, status, checkedIds = []) {
	return mutate(`/orders/${encodeURIComponent(id)}/transition`, "POST", {
		status,
		checkedIds,
	});
}
export async function completeDemoPayment(id) {
	const order = state.orders.find((o) => o.id === id),
		items = cartItems.value;
	const matches =
		order?.room === state.room &&
		order.items.length === items.length &&
		order.items.every((item) =>
			items.some(
				(current) =>
					current.id === item.id &&
					current.quantity === item.quantity &&
					totalCents([current]) === totalCents([item]),
			),
		);
	const cart = JSON.stringify(state.cart);
	await mutate(`/orders/${encodeURIComponent(id)}/pay-demo`, "POST");
	if (matches && cart === JSON.stringify(state.cart)) clearCart();
}
export const saveProduct = (product) =>
	mutate(`/products/${encodeURIComponent(product.id)}`, "PUT", product);
export const saveRoom = (room, originalId = room.id) =>
	mutate(`/rooms/${encodeURIComponent(originalId)}`, "PUT", room);
export const saveAccount = (account) =>
	mutate(
		account.id
			? `/accounts/${encodeURIComponent(account.id)}`
			: "/accounts",
		account.id ? "PUT" : "POST",
		account,
	);
export const saveImage = (file) => uploadImage(file, session("admin")?.token);
export function resetDemo() {
	clearCart();
}
