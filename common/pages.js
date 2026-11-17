export const designPages = [
	["01", "扫码点餐", "pages/index/index", "顾客点餐"],
	["02", "已选餐品", "pages/customer/cart", "顾客点餐"],
	["03", "确认订单", "pages/customer/checkout", "顾客点餐"],
	["04", "微信支付", "pages/customer/payment", "顾客点餐"],
	["05", "支付成功", "pages/customer/success", "顾客订单"],
	["06", "我的订单", "pages/customer/orders", "顾客订单"],
	["07", "制作与配送进度", "pages/customer/progress", "顾客订单"],
	["08", "已送达", "pages/customer/completed", "顾客订单"],
	["09", "接单工作台", "pages/supplier/workbench", "食堂与配送"],
	["10", "待接单详情", "pages/supplier/detail", "食堂与配送"],
	["11", "制作与出餐", "pages/supplier/preparing", "食堂与配送"],
	["12", "配送与确认送达", "pages/supplier/delivery", "食堂与配送"],
	["13", "管理首页", "pages/admin/index", "包厢与餐品"],
	["14", "包厢管理", "pages/admin/rooms", "包厢与餐品"],
	["15", "专属二维码", "pages/admin/qrcode", "包厢与餐品"],
	["16", "餐品管理", "pages/admin/products", "包厢与餐品"],
	["17", "餐品编辑", "pages/admin/product-edit", "包厢与餐品"],
	["18", "订单管理", "pages/admin/orders", "订单与权限"],
	["19", "订单与支付记录", "pages/admin/order-detail", "订单与权限"],
	["20", "外包账号", "pages/admin/accounts", "订单与权限"],
	["21", "权限与订单分配", "pages/admin/permissions", "订单与权限"],
	["22", "支付配置与状态记录", "pages/admin/payment", "订单与权限"],
	["23", "收款记录", "pages/supplier/ledger", "食堂与配送"],
	["24", "门店服务", "pages/service/index", "门店服务"],
].map(([id, title, path, group]) => ({ id, title, path, group }));

export function go(id, query = {}, { replace = false } = {}) {
	const target = designPages.find(
		(page) => page.id === String(id).padStart(2, "0"),
	);
	if (!target) return;
	const search = Object.entries(query)
		.map(
			([key, value]) =>
				`${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
		)
		.join("&");
	const url = `/${target.path}${search ? "?" + search : ""}`;
	const pages = getCurrentPages();
	if (replace || pages.length >= 8) uni.redirectTo({ url });
	else uni.navigateTo({ url });
}

export function goHome() {
	uni.reLaunch({ url: "/pages/service/index" });
}

// Every registered screen has a safe destination for notification/QR-code entry.
// Root screens reset the stack so returning never reopens checkout or another role.
const returnTargets = {
	"02": "01", "03": "01", "04": "06", "07": "06", "08": "06",
	"10": "09", "11": "09", "12": "09", "14": "13", "15": "14",
	"16": "13", "17": "16", "18": "13", "19": "18", "20": "13",
	"21": "20", "22": "20", "23": "09",
};
export function returnNavigation(page, orderingEnabled = false) {
	const id = String(page).padStart(2, "0");
	if (["01", "09", "13"].includes(id)) return { target: "24", label: "首页", root: true };
	if (id === "05") return { target: "06", label: "订单", root: true };
	if (id === "06") return { target: orderingEnabled ? "01" : "24", label: orderingEnabled ? "点餐" : "首页", root: true };
	if (id === "24") return { target: orderingEnabled ? "01" : "06", label: orderingEnabled ? "点餐" : "订单", root: true };
	const target = returnTargets[id] || "24";
	return { target: !orderingEnabled && ["01", "02", "03", "04"].includes(target) ? "24" : target, label: "返回", root: false };
}
let returning = false;
export function back(fallback = "24", { root = false } = {}) {
	if (returning) return;
	returning = true;
	const target = designPages.find(page => page.id === fallback) || designPages.find(page => page.id === "24");
	const done = () => { returning = false; };
	const reset = () => uni.reLaunch({ url: "/" + target.path, complete: done });
	if (!root && getCurrentPages().length > 1) {
		uni.navigateBack({ success: done, fail: reset });
	} else reset();
}

export const toast = (title) =>
	uni.showToast({ title, icon: "none", duration: 2200 });
