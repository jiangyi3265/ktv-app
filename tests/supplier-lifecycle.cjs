// Run only against an isolated backend with demo payment enabled.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const apiOrigin = process.env.KTV_TEST_API_ORIGIN || "http://127.0.0.1:8080";
const appOrigin = process.env.KTV_TEST_APP_ORIGIN || "http://127.0.0.1:5174";
const output = process.env.KTV_TEST_OUTPUT || ".local/supplier-lifecycle";

async function api(url, token, body) {
	const response = await fetch(apiOrigin + "/ktv-api" + url, {
		method: body === undefined ? "GET" : "POST",
		headers: {
			"Content-Type": "application/json",
			"X-KTV-Token": token || "",
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	assert.equal(response.status, 200, url);
	return response.json();
}

(async () => {
	const access = JSON.parse(
		(
			await fs.readFile(
				process.env.KTV_TEST_ACCESS || ".local/access.json",
				"utf8",
			)
		).replace(/^\uFEFF/, ""),
	);
	const admin = await api("/sessions/staff", "", access.admin);
	const state = await api("/state", admin.token);
	assert.equal(
		state.demoPayment,
		true,
		"Refusing order writes outside an isolated demo-payment environment",
	);
	let worker;
	const customer = await api("/sessions/customer", "", {});
	const room = state.rooms.find((item) => item.bound);
	const product = state.products.find((item) => item.onSale);
	assert(room && product);
	const qr = await api(
		"/rooms/" + encodeURIComponent(room.id) + "/qr",
		admin.token,
		{},
	);
	const order = await api("/orders", customer.token, {
		room: room.id,
		scene: qr.scene,
		items: [{ id: product.id, quantity: 1 }],
		requestKey: "supplier-lifecycle-" + Date.now(),
	});
	await api("/orders/" + order.id + "/pay-demo", customer.token, {});
	await fs.mkdir(output, { recursive: true });
	const browser = await chromium.launch();
	const page = await browser.newPage({
		viewport: { width: 390, height: 844 },
	});
	const errors = [];
	page.on("pageerror", (error) => {
		errors.push(error.message);
		console.error("Page error", page.url(), error.stack);
	});
	page.setDefaultTimeout(12000);
	const screen = () => page.locator(".phone-screen:visible").last();
	const button = (label) =>
		screen()
			.locator("uni-button")
			.filter({ hasText: new RegExp("^\\s*" + label + "\\s*$") });
	try {
		await page.goto(appOrigin + "/#/pages/supplier/detail?id=" + order.id);
		await page
			.locator(".login-input input")
			.first()
			.fill(access.supplier.username);
		await page
			.locator(".login-input input")
			.nth(1)
			.fill(access.supplier.password);
		const loggedIn = page.waitForResponse(
			(r) =>
				r.url().endsWith("/sessions/staff") &&
				r.request().method() === "POST",
		);
		await button("登录").click();
		worker = await (await loggedIn).json();
		await screen().locator(".check-box").waitFor();
		await page.waitForTimeout(1200);
		await screen().locator(".check-box").click();
		await page.waitForTimeout(2200);
		assert.equal(await screen().locator(".check-box.checked").count(), 1);
		await button("确认有货并接单").click();
		await page.waitForURL("**/pages/supplier/preparing?id=" + order.id);
		await screen().locator(".back-button").click();
		await page.waitForURL("**/pages/supplier/workbench");
		await api("/orders/" + order.id + "/transition", worker.token, {
			status: "delivering",
			checkedIds: [product.id],
		});
		await page.waitForTimeout(2500);
		assert(
			page.url().endsWith("/pages/supplier/workbench"),
			"Hidden pages must not navigate on another device's update",
		);

		// A notification/deep link may still target the old detail route.
		await page.goto(appOrigin + "/#/pages/supplier/detail?id=" + order.id);
		await page.waitForURL("**/pages/supplier/delivery?id=" + order.id);
		await button("确认送达").click();
		await screen().locator(".dialog").waitFor();

		// Test refund presentation without performing any refund or changing paid data.
		let refundState = "refunding";
		await page.route("**/ktv-api/state?*", async (route) => {
			const response = await route.fetch();
			const data = await response.json();
			for (const item of [
				...(data.orders || []),
				data.orderDetail,
			].filter(Boolean)) {
				if (item.id === order.id) item.status = refundState;
			}
			await route.fulfill({ response, json: data });
		});
		await screen().locator(".stopped-order").waitFor();
		assert.equal(await screen().locator(".page-footer").count(), 0);
		assert.equal(await screen().locator(".dialog").count(), 0);
		assert.match(
			await screen().locator(".stopped-order").innerText(),
			/退款中/,
		);
		for (const width of [320, 390, 430]) {
			await page.setViewportSize({ width, height: 844 });
			assert.equal(
				await page.evaluate(
					() => document.documentElement.scrollWidth > innerWidth,
				),
				false,
			);
			await page.screenshot({
				path: path.join(output, "refunding-" + width + ".png"),
			});
		}
		refundState = "refunded";
		await screen()
			.locator(".stopped-order")
			.getByText("已退款", { exact: true })
			.waitFor();
		assert.equal(
			await screen()
				.locator(".check-box, .packing-note, .page-footer")
				.count(),
			0,
		);
		await page.unroute("**/ktv-api/state?*");
		await api("/orders/" + order.id + "/transition", worker.token, {
			status: "completed",
		});
		const finished = await api("/orders/" + order.id, customer.token);
		assert.equal(finished.status, "completed");
		assert.deepEqual(errors, []);
		const result = {
			isolatedOrder: order.id,
			checksSurvivePolling: true,
			backReturnsToWorkbench: true,
			hiddenPagesStayHidden: true,
			staleDeepLinkCorrected: true,
			refundStopsActionsAndClosesDialog: true,
			refundPresentationMocked: true,
			widths: [320, 390, 430],
			errors,
		};
		await fs.writeFile(
			path.join(output, "report.json"),
			JSON.stringify(result, null, 2),
		);
		console.log(JSON.stringify(result));
	} catch (error) {
		console.error(
			"Failure page",
			page.url(),
			(await page.locator("body").innerText()).slice(-900),
		);
		throw error;
	} finally {
		await browser.close();
	}
})().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
