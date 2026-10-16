const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const pages = [
	["01", "index/index", "Catalog", "包厢点餐"],
	["02", "customer/cart", "Catalog", "已选餐品"],
	["03", "customer/checkout", "Checkout", "确认订单"],
	["04", "customer/payment", "Checkout", "微信支付"],
	["05", "customer/success", "CustomerOrders", "支付结果"],
	["06", "customer/orders", "CustomerOrders", "我的订单"],
	["07", "customer/progress", "CustomerOrders", "订单详情"],
	["08", "customer/completed", "CustomerOrders", "已送达"],
	["09", "supplier/workbench", "Supplier", "接单工作台"],
	["10", "supplier/detail", "Supplier", "订单详情"],
	["11", "supplier/preparing", "Supplier", "制作中"],
	["12", "supplier/delivery", "Supplier", "配送中"],
	["13", "admin/index", "AdminBasics", "KTV 管理"],
	["14", "admin/rooms", "AdminBasics", "包厢管理"],
	["15", "admin/qrcode", "AdminBasics", "包厢二维码"],
	["16", "admin/products", "AdminBasics", "餐品管理"],
	["17", "admin/product-edit", "AdminBasics", "编辑餐品"],
	["18", "admin/orders", "AdminOrders", "订单管理"],
	["19", "admin/order-detail", "AdminOrders", "订单详情"],
	["20", "admin/accounts", "AdminOrders", "外包账号"],
	["21", "admin/permissions", "AdminOrders", "账号权限"],
	["22", "admin/payment", "AdminOrders", "支付与状态"],
];
for (const [id, route, view] of pages) {
	const filename = path.join(root, "pages", route + ".vue");
	fs.mkdirSync(path.dirname(filename), { recursive: true });
	fs.writeFileSync(
		filename,
		`<template><${view} page="${id}" :query="query" /></template>\n<script setup>\nimport { usePageQuery } from '../../common/usePageQuery'\nimport ${view} from '../../views/${view}.vue'\nconst query = usePageQuery()\n</script>\n`,
	);
}
fs.writeFileSync(
	path.join(root, "pages.json"),
	JSON.stringify(
		{
			pages: pages.map(([, route, , title]) => ({
				path: "pages/" + route,
				style: {
					navigationStyle: "custom",
					navigationBarTitleText: title,
					disableScroll: true,
				},
			})),
			globalStyle: {
				navigationStyle: "custom",
				navigationBarTextStyle: "black",
				navigationBarTitleText: "包厢点餐",
				backgroundColor: "#FAF9F6",
			},
			uniIdRouter: {},
		},
		null,
		2,
	) + "\n",
);
console.log(`Registered ${pages.length} uni-app pages.`);
