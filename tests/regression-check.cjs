const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");

async function main() {
	const browser = await chromium.launch();
	const results = [];
	const cases = [
		[
			"320px 购物车摘要保持单行",
			async ({ page, go, screen }) => {
				await page.setViewportSize({ width: 320, height: 640 });
				await go("index/index");
				const label = screen()
					.locator(".cart-summary > uni-text")
					.first();
				const bounds = await label.evaluate((el) => ({
					height: el.getBoundingClientRect().height,
					line: parseFloat(getComputedStyle(el).lineHeight),
				}));
				assert.ok(
					bounds.height <= bounds.line + 1,
					`摘要高度 ${bounds.height} 超过单行 ${bounds.line}`,
				);
			},
		],
		[
			"牛柳饭订单核对后可配送，完成后状态文案一致",
			async ({ go, screen, click }) => {
				await go("supplier/detail?id=0087");
				await click("确认接单");
				await screen().locator(".check-box").waitFor();
				const box = screen().locator(".check-box").first();
				if (!(await box.getAttribute("class")).includes("checked"))
					await box.click();
				assert.notEqual(
					await screen()
						.locator(".page-footer .primary-button")
						.getAttribute("disabled"),
					"true",
				);
				await click("出餐并开始配送");
				await click("确认送达");
				await screen().locator(".dialog .primary-button").click();
				await screen().locator(".delivered-feedback").waitFor();
				assert.doesNotMatch(
					await screen().locator(".supplier-subtitle").innerText(),
					/正在配送/,
				);
			},
		],
		[
			"历史待付款订单使用自己的金额和包厢",
			async ({ go, screen, page, click }) => {
				await go("index/index?room=B03");
				await go("customer/payment?id=0088");
				assert.match(
					await screen().locator(".payment-value").innerText(),
					/38\.00/,
				);
				assert.match(
					await screen().locator(".destination-title").innerText(),
					/A08/,
				);
				await click("确认支付");
				await page.getByText("模拟成功", { exact: true }).click();
				await screen().locator(".success-amount").waitFor();
				assert.match(
					await screen().locator(".success-amount").innerText(),
					/38\.00/,
				);
				await go("index/index");
				assert.match(
					await screen().locator(".cart-summary").innerText(),
					/86/,
				);
				assert.match(
					await screen().locator(".room-chip").innerText(),
					/B03/,
				);
			},
		],
		[
			"已支付的订单不会再次显示确认扣款操作",
			async ({ go, screen }) => {
				await go("customer/payment?id=0086");
				assert.match(
					await screen().locator(".wechat-button").innerText(),
					/查看订单/,
				);
				assert.match(
					await screen().locator(".payment-caption").innerText(),
					/已支付/,
				);
			},
		],
		[
			"编辑不同餐品时显示对应图片",
			async ({ go, screen, page }) => {
				await go("admin/product-edit");
				const original = await screen()
					.locator(".edit-food-photo .food-source img")
					.getAttribute("src");
				await go("admin/products");
				await screen()
					.locator(".product-card")
					.filter({ hasText: "黑椒牛柳饭" })
					.locator(".edit-link")
					.click();
				await screen().locator(".edit-food-photo").waitFor();
				await page.waitForTimeout(150);
				assert.equal(
					await screen()
						.locator(".product-form input")
						.first()
						.inputValue(),
					"黑椒牛柳饭",
				);
				assert.notEqual(
					await screen()
						.locator(".edit-food-photo .food-source img")
						.getAttribute("src"),
					original,
				);
			},
		],
		[
			"携带待付款订单号时不会误显示已送达",
			async ({ go, screen }) => {
				await go("customer/completed?id=0088");
				assert.doesNotMatch(
					await screen().locator(".order-status-title").innerText(),
					/已送达/,
				);
			},
		],
	];
	for (const [name, run] of cases) {
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			isMobile: true,
			hasTouch: true,
		});
		const page = await context.newPage();
		page.setDefaultTimeout(6000);
		const screen = () => page.locator(".phone-screen:visible").last();
		const go = async (route) => {
			await page.goto("http://127.0.0.1:5174/#/pages/" + route, {
				waitUntil: "networkidle",
			});
			await page.waitForTimeout(200);
		};
		const click = async (label) =>
			screen()
				.locator("uni-button")
				.filter({ hasText: new RegExp("^\\s*" + label + "\\s*$") })
				.last()
				.click();
		try {
			await run({ page, go, screen, click });
			results.push({ name, passed: true });
		} catch (error) {
			results.push({ name, passed: false, error: error.message });
		}
		await context.close();
	}
	await browser.close();
	await fs.writeFile(
		"qa/regression-report.json",
		JSON.stringify(results, null, 2),
	);
	console.log(JSON.stringify(results, null, 2));
	if (results.some((result) => !result.passed)) process.exitCode = 1;
}
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
