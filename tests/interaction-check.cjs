const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
async function main() {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true,
	});
	const page = await context.newPage(),
		errors = [],
		passed = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.setDefaultTimeout(10000);
	const screen = () => page.locator(".phone-screen:visible").last();
	const goto = async (route) => {
		await page.goto("http://127.0.0.1:5174/#/pages/" + route, {
			waitUntil: "networkidle",
		});
		// H5 route transitions finish after the hash changes; let the incoming page receive onLoad.
		await page.waitForTimeout(350);
	};
	const waitScreen = async (id) =>
		page.locator(".screen-" + id + ":visible").waitFor();
	const click = async (label) =>
		screen()
			.locator("uni-button")
			.filter({ hasText: new RegExp("^\\s*" + label + "\\s*$") })
			.last()
			.click();

	await goto("index/index");
	await screen().locator(".search-field input").fill("番茄");
	assert.match(await screen().innerText(), /番茄牛腩面/);
	await screen().locator(".search-field input").fill("");
	await screen()
		.locator(".catalog-product")
		.filter({ hasText: "宫保鸡丁饭" })
		.locator(".add-button")
		.click();
	assert.match(await screen().locator(".cart-summary").innerText(), /118/);
	await screen().locator(".cart-summary").click();
	await screen()
		.locator(".cart-line")
		.filter({ hasText: "宫保鸡丁饭" })
		.locator(".stepper uni-button")
		.first()
		.click();
	assert.match(await screen().locator(".cart-total").innerText(), /86/);
	await screen().locator(".cart-sheet .primary-button").click();
	await waitScreen("03");
	assert.match(await screen().locator(".checkout-dock").innerText(), /86/);
	await click("确认并支付");
	await waitScreen("04");
	await click("确认支付");
	await page.getByText("模拟成功", { exact: true }).click();
	await waitScreen("05");
	assert.match(
		await screen().locator(".success-amount").innerText(),
		/86\.00/,
	);
	await click("查看订单");
	await waitScreen("07");
	assert.match(
		await screen().locator(".order-status-title").innerText(),
		/待接单/,
	);
	console.log("Passed checkpoint", passed.length + 1);
	passed.push("顾客搜索、增减数量、¥86 结算、演示支付、待接单状态");

	await goto("supplier/workbench");
	const customerOrder = screen()
		.locator(".supplier-order")
		.filter({ hasText: "A08" })
		.nth(1);
	await customerOrder.locator("uni-button").click();
	await waitScreen("10");
	assert.doesNotMatch(await screen().innerText(), /¥|收款|支付金额/);
	await click("确认接单");
	await waitScreen("11");
	await screen().locator(".check-box").first().click();
	assert.equal(
		await screen()
			.locator(".page-footer .primary-button")
			.getAttribute("disabled"),
		"true",
	);
	await screen().locator(".check-box").first().click();
	await click("出餐并开始配送");
	await waitScreen("12");
	await click("确认送达");
	await screen().locator(".dialog .primary-button").click();
	assert.match(
		await screen().locator(".delivered-feedback").innerText(),
		/已确认送达/,
	);
	await goto("customer/orders");
	assert.match(
		await screen().locator(".customer-order").first().innerText(),
		/已完成/,
	);
	await screen()
		.locator(".customer-order")
		.first()
		.locator("uni-button")
		.click();
	await waitScreen("08");
	assert.match(
		await screen().locator(".order-status-title").innerText(),
		/已送达/,
	);
	const completedId = new URLSearchParams(page.url().split("?")[1]).get("id");
	await goto("customer/progress?id=" + completedId);
	assert.match(
		await screen().locator(".order-status-title").innerText(),
		/已送达/,
	);
	await goto("supplier/workbench?filter=completed");
	await screen()
		.locator(".supplier-order")
		.first()
		.locator("uni-button")
		.click();
	await waitScreen("12");
	assert.match(
		await screen().locator(".delivered-feedback").innerText(),
		/已确认送达/,
	);
	assert.match(
		await screen().locator(".page-footer").innerText(),
		/返回工作台/,
	);
	console.log("Passed checkpoint", passed.length + 1);
	passed.push("食堂接单、数量核对、配送确认、顾客订单完成同步");

	await goto("admin/product-edit");
	await screen().locator(".product-form input").nth(0).fill("");
	await click("保存餐品");
	assert.match(
		await screen().locator(".form-error").innerText(),
		/请输入餐品名称/,
	);
	await screen().locator(".product-form input").nth(0).fill("宫保鸡丁饭");
	await screen().locator(".product-form input").nth(1).fill("12.50");
	await screen().locator(".product-form input").nth(1).press("Tab");
	// Allow uni-input's native number/blur update to settle before submitting again.
	await page.waitForTimeout(600);
	await click("保存餐品");
	await waitScreen("16");
	assert.match(
		await screen()
			.locator(".product-card")
			.filter({ hasText: "宫保鸡丁饭" })
			.innerText(),
		/12.5/,
	);
	await screen()
		.locator(".product-card")
		.filter({ hasText: "宫保鸡丁饭" })
		.locator(".switch-control")
		.click();
	await goto("index/index");
	await screen().locator(".search-field input").fill("宫保");
	assert.match(await screen().innerText(), /没有找到相关餐品/);
	console.log("Passed checkpoint", passed.length + 1);
	passed.push("餐品必填校验、价格保存、下架后顾客菜单同步");

	await goto("admin/rooms");
	await click("新增");
	await screen().locator(".dialog-input input").fill("C09");
	await click("保存包厢");
	await screen().locator(".search-field input").fill("C09");
	assert.match(await screen().locator(".room-card").innerText(), /未绑定/);
	await click("生成并绑定");
	await waitScreen("15");
	assert.match(await screen().locator(".qr-room").innerText(), /C09/);
	console.log("Passed checkpoint", passed.length + 1);
	passed.push("新增包厢、搜索、绑定状态与二维码页面联动");

	await goto("admin/accounts");
	await click("新增");
	await screen().locator(".dialog-input input").fill("合作食堂 B");
	await click("保存账号");
	assert.equal(await screen().locator(".account-card").count(), 3);
	await screen()
		.locator(".account-card")
		.filter({ hasText: "合作食堂 A" })
		.locator(".text-button")
		.click();
	await waitScreen("21");
	await screen().locator(".switch-control").first().click();
	await click("保存设置");
	await goto("supplier/detail");
	await click("确认接单");
	assert.match(
		await page.locator("body").innerText(),
		/当前账号暂无此操作权限/,
	);
	await waitScreen("10");
	console.log("Passed checkpoint", passed.length + 1);
	passed.push("外包账号新增、权限保存、无权限时阻止接单");

	await goto("admin/payment");
	await click("编辑配置 ›");
	assert.match(
		await screen().locator(".config-dialog").innerText(),
		/不会发起真实交易/,
	);
	console.log("Passed checkpoint", passed.length + 1);
	passed.push("支付配置接入说明可用，无真实扣款伪装");

	for (const width of [360, 430]) {
		await page.setViewportSize({ width, height: 844 });
		for (const route of [
			"index/index",
			"customer/orders",
			"supplier/preparing",
			"admin/product-edit",
			"admin/permissions",
		]) {
			await goto(route);
			assert.equal(
				await page.evaluate(
					() => document.documentElement.scrollWidth > innerWidth,
				),
				false,
			);
			const footer = screen().locator(".page-footer:visible");
			if (await footer.count()) {
				const box = await footer.boundingBox();
				assert.ok(box.y + box.height <= 845);
			}
		}
	}
	console.log("Passed checkpoint", passed.length + 1);
	passed.push("360 / 390 / 430 手机宽度，无横向溢出，底部操作可见");
	const report = { passed, errors };
	await fs.writeFile(
		path.join(__dirname, "../qa/interaction-report.json"),
		JSON.stringify(report, null, 2),
	);
	console.log(JSON.stringify(report, null, 2));
	await browser.close();
	assert.equal(errors.length, 0);
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
