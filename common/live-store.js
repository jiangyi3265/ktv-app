import { reactive, computed } from "vue";
import { request, uploadImage } from "./api";
import { money, totalCents, setQuantity } from "./domain.mjs";
const LOCAL_KEY = "ktv-local-v1",
	local = uni.getStorageSync(LOCAL_KEY) || {};
export const state = reactive({
	customerId: "",
	supplierId: "",
	room: local.scene ? local.room : "",
	scene: local.scene || "",
	cart: local.cart || {},
	products: [],
	orders: [],
	orderCounts: {},
	orderAlerts: [],
	orderDetail: null,
	orderPage: 1,
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
	wechatPayment: false,
	hasMoreOrders: false,
});
let revision = -1,
	generation = 0,
	timer,
	boot;
const sessionKey = (role) => `ktv-session-${role}-v1`;
const session = (role) => uni.getStorageSync(sessionKey(role)) || null;
const orderFilters = {};
const filterKey = (role) => JSON.stringify(orderFilters[role] || {});
export async function setOrderFilter(role, filters = {}) {
	if (JSON.stringify(filters) === filterKey(role)) return;
	orderFilters[role] = filters;
	if (connection.role !== role) return;
	state.orderPage = 1;
	state.orders = [];
	if (connection.ready) await refresh();
}
export function persist() {
	const saved = {};
	for (const key of [
		"room",
		"scene",
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
		!data ||
		!Number.isInteger(data.revision) ||
		data.role !== role ||
		!["products", "orders", "rooms", "accounts"].every((key) =>
			Array.isArray(data[key]),
		)
	)
		throw new Error("服务返回的数据无效，请稍后重试");
	if (
		epoch !== generation ||
		role !== connection.role ||
		(data.page && data.page !== state.orderPage) ||
		data.revision < revision
	)
		return;
	revision = data.revision;
	for (const key of ["products", "orders", "rooms", "accounts"])
		state[key] = data[key];
	if (role === "customer") state.customerId = data.subject;
	if (role === "supplier") state.supplierId = data.subject;
	connection.demoPayment = data.demoPayment;
	connection.wechatPayment = data.wechatPayment;
	state.orderDetail = data.orderDetail || null;
	state.orderCounts = data.orderCounts || {};
	state.orderAlerts = data.orderAlerts || [];
	connection.hasMoreOrders = data.hasMore;
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
		const key = filterKey(role);
		const filters = Object.entries(orderFilters[role] || {})
			.map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
			.join("&");
		const data = await request(
			`/state?page=${state.orderPage}&orderId=${encodeURIComponent(state.activeOrderId || "")}&${filters}`,
			{ token: current.token },
		);
		if (key === filterKey(role)) apply(data, role, epoch);
		return data;
	} catch (error) {
		handleError(error, role, epoch);
		throw error;
	}
}
function schedule() {
	clearTimeout(timer);
	if (!state.foreground || connection.needsLogin || !session(connection.role))
		return;
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
	state.orderPage = 1;
	state.orderDetail = null;
	state.orderCounts = {};
	state.orderAlerts = [];
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
				// #ifdef MP-WEIXIN
				const wxLogin = await new Promise((resolve, reject) =>
					uni.login({
						provider: "weixin",
						success: resolve,
						fail: reject,
					}),
				);
				current = await request("/sessions/wechat", {
					method: "POST",
					data: { code: wxLogin.code },
				});
				// #endif
				// #ifndef MP-WEIXIN
				current = await request("/sessions/customer", {
					method: "POST",
					data: {
						recovery:
							uni.getStorageSync("ktv-customer-recovery") ||
							undefined,
					},
				});
				if (current.recovery)
					uni.setStorageSync(
						"ktv-customer-recovery",
						current.recovery,
					);
				// #endif
				uni.setStorageSync(sessionKey(role), current);
			}
			if (!current) {
				connection.needsLogin = true;
				return;
			}
			// #ifndef MP-WEIXIN
			if (
				role === "customer" &&
				!uni.getStorageSync("ktv-customer-recovery")
			) {
				const recovery = await request("/sessions/recovery", {
					method: "POST",
					token: current.token,
				});
				uni.setStorageSync("ktv-customer-recovery", recovery.recovery);
			}
			// #endif
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
	try {
		if (current)
			await request("/session", {
				method: "DELETE",
				token: current.token,
			});
	} finally {
		uni.removeStorageSync(sessionKey(role));
		connection.ready = false;
		await activate(role);
	}
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
		// The mutation was acknowledged. A later read failure must not turn it into a failed write.
		await refresh().catch(() => {});
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
		(state.orderDetail?.id === state.activeOrderId
			? state.orderDetail
			: null) ||
		(!state.activeOrderId ? state.orders[0] : null) ||
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
		scene: state.scene,
		items,
		requestKey: draft.key,
	});
	state.activeOrderId = result.id;
	persist();
	uni.removeStorageSync("ktv-create-request");
	return state.orders.find((o) => o.id === result.id) || result;
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
export const cancelOrder = (id) =>
	mutate(`/orders/${encodeURIComponent(id)}/cancel`, "POST");
export async function changeOrderPage(page) {
	const previous = state.orderPage;
	state.orderPage = page;
	try {
		await refresh();
	} catch (e) {
		state.orderPage = previous;
		throw e;
	}
}
export const reassignOrder = (order, supplierId, reason) =>
	mutate(`/orders/${encodeURIComponent(order.id)}/reassign`, "POST", {
		supplierId,
		reason,
		version: order.version,
	});
export const refundOrder = (order, reason) =>
	mutate(`/orders/${encodeURIComponent(order.id)}/refund`, "POST", {
		reason,
		version: order.version,
	});
export const rotatePassword = (oldPassword, password) =>
	mutate("/admin/password", "POST", { oldPassword, password });
export const roomQR = (id, rotate = false, type = "h5") =>
	request(
		`/rooms/${encodeURIComponent(id)}/qr?rotate=${rotate}&type=${type}`,
		{ method: "POST", token: session("admin")?.token },
	);
export const readiness = () =>
	request("/readiness", { token: session("admin")?.token });
export async function scanRoom(scene) {
	state.room = "";
	state.scene = "";
	persist();
	const result = await request(`/scan/${encodeURIComponent(scene)}`);
	state.room = result.room;
	state.scene = result.scene;
	persist();
}
export async function payWechat(id) {
	// #ifndef MP-WEIXIN
	throw new Error("请使用微信小程序扫码支付");
	// #endif
	// #ifdef MP-WEIXIN
	const token = session("customer")?.token;
	const cart = JSON.stringify(state.cart);
	const before = await request(`/orders/${encodeURIComponent(id)}`, {
		token,
	});
	const matches =
		before.room === state.room &&
		before.items.length === cartItems.value.length &&
		before.items.every((item) =>
			cartItems.value.some(
				(current) =>
					current.id === item.id &&
					current.quantity === item.quantity,
			),
		);
	const params = await request(`/orders/${encodeURIComponent(id)}/prepay`, {
		method: "POST",
		token,
	});
	let paymentError;
	try {
		await new Promise((resolve, reject) =>
			uni.requestPayment({
				...params,
				provider: "wxpay",
				success: resolve,
				fail: reject,
			}),
		);
	} catch (error) {
		paymentError = error;
	}
	const order = await request(
		`/orders/${encodeURIComponent(id)}/payment-query`,
		{ method: "POST", token },
	);
	await refresh().catch(() => {});
	if (!order.paid)
		throw new Error(
			paymentError
				? "支付未完成，可在订单中继续支付"
				: "付款结果正在确认，请稍后查看订单，勿重复付款",
		);
	if (matches && cart === JSON.stringify(state.cart)) clearCart();
	return order;
	// #endif
}
export function resetDemo() {
	clearCart();
}
