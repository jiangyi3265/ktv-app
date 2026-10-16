import { reactive, computed } from "vue";
import {
	totalCents,
	money,
	setQuantity,
	transitionOrder,
	supplierOrder,
} from "./domain.mjs";

export const DEMO_MODE = true;
const STORAGE_KEY = "ktv-design-demo-v2";
export const initialProducts = [
	{
		id: "chicken",
		name: "宫保鸡丁饭",
		category: "主食",
		price: 32,
		image: "chicken",
		description: "经典川味，香辣过瘾",
		onSale: true,
	},
	{
		id: "beef",
		name: "黑椒牛柳饭",
		category: "主食",
		price: 38,
		image: "beef",
		description: "黑椒浓郁，牛肉鲜嫩",
		onSale: true,
	},
	{
		id: "bites",
		name: "香酥鸡米花",
		category: "小吃",
		price: 22,
		image: "bites",
		description: "外酥里嫩，香气四溢",
		onSale: true,
	},
	{
		id: "noodle",
		name: "番茄牛腩面",
		category: "主食",
		price: 36,
		image: "noodle",
		description: "浓郁番茄，软烂牛腩",
		onSale: true,
	},
];
export const sampleItems = [
	{ ...initialProducts[0], quantity: 2 },
	{ ...initialProducts[2], quantity: 1 },
];
const initialState = {
	customerId: "demo-customer",
	room: "A08",
	cart: { chicken: 2, bites: 1 },
	products: initialProducts,
	sound: true,
	foreground: true,
	activeOrderId: "0086",
	selectedRoom: "A08",
	selectedProduct: "chicken",
	selectedAccount: "A01",
	rooms: [
		{ id: "A08", bound: true },
		{ id: "A09", bound: true },
		{ id: "B03", bound: true },
		{ id: "B05", bound: false },
	],
	accounts: [
		{
			id: "A01",
			name: "合作食堂 A",
			enabled: true,
			process: true,
			deliver: true,
		},
		{
			id: "A02",
			name: "备用账号",
			enabled: false,
			process: true,
			deliver: true,
		},
	],
	orders: [
		{
			id: "0086",
			room: "A08",
			status: "delivering",
			paid: true,
			time: "今天 20:42",
			supplierId: "A01",
			items: sampleItems,
		},
		{
			id: "0087",
			room: "B03",
			status: "pending",
			paid: true,
			time: "今天 21:02",
			supplierId: "A01",
			items: [{ ...initialProducts[1], quantity: 2 }],
		},
		{
			id: "0088",
			room: "A08",
			status: "unpaid",
			paid: false,
			time: "今天 21:05",
			supplierId: "A01",
			items: [{ ...initialProducts[1], quantity: 1 }],
		},
		{
			id: "0081",
			room: "A08",
			status: "completed",
			paid: true,
			time: "昨天 19:36",
			supplierId: "A01",
			items: [{ ...initialProducts[3], quantity: 1 }],
		},
	].map((order) => ({
		...order,
		customerId: order.id === "0087" ? "other-customer" : "demo-customer",
	})),
};
let saved;
try {
	saved = uni.getStorageSync(STORAGE_KEY);
} catch {
	saved = null;
}
export const state = reactive(
	saved && typeof saved === "object"
		? { ...initialState, ...saved, foreground: true }
		: initialState,
);
export const persist = () =>
	uni.setStorageSync(STORAGE_KEY, JSON.parse(JSON.stringify(state)));
export const cartItems = computed(() =>
	state.products
		.filter((product) => product.onSale && state.cart[product.id])
		.map((product) => ({ ...product, quantity: state.cart[product.id] })),
);
export const cartCount = computed(() =>
	cartItems.value.reduce((sum, item) => sum + item.quantity, 0),
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
export const orderTotal = (order) => money(totalCents(order.items));
export const orderCount = (order) =>
	order.items.reduce((sum, item) => sum + item.quantity, 0);
export const activeOrder = computed(
	() =>
		state.orders.find((order) => order.id === state.activeOrderId) ||
		state.orders[0],
);
export const visibleSupplierOrders = computed(() =>
	state.orders.map((order) => supplierOrder(order, "A01")).filter(Boolean),
);
export function updateOrder(id, next) {
	const index = state.orders.findIndex((order) => order.id === id);
	if (index < 0) throw new Error("订单不存在");
	state.orders[index] = transitionOrder(state.orders[index], next);
	persist();
}
export function createUnpaidOrder() {
	if (!cartItems.value.length) throw new Error("请先选择餐品");
	const id = String(
		Math.max(...state.orders.map((order) => Number(order.id))) + 1,
	).padStart(4, "0");
	const order = {
		id,
		room: state.room,
		customerId: state.customerId,
		status: "unpaid",
		paid: false,
		time: "今天 21:08",
		supplierId: "A01",
		items: JSON.parse(JSON.stringify(cartItems.value)),
	};
	state.orders.unshift(order);
	state.activeOrderId = id;
	persist();
	return order;
}
export function completeDemoPayment(id) {
	if (!DEMO_MODE) throw new Error("请先接入服务端微信支付接口");
	const order = state.orders.find((item) => item.id === id);
	const currentItems = cartItems.value;
	const matchesCart =
		order?.room === state.room &&
		order.items.length === currentItems.length &&
		order.items.every((item) =>
			currentItems.some(
				(current) =>
					current.id === item.id &&
					current.quantity === item.quantity &&
					totalCents([current]) === totalCents([item]),
			),
		);
	updateOrder(id, "pending");
	if (matchesCart) clearCart();
}
export function resetDemo() {
	uni.removeStorageSync(STORAGE_KEY);
	uni.reLaunch({ url: "/pages/index/index" });
}
