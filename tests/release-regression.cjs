const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const path = require("node:path");
async function main() {
	assert(
		process.env.KTV_TEST_ACCESS,
		"Set KTV_TEST_ACCESS to credentials for an isolated test database",
	);
	const access = JSON.parse(
		(await fs.readFile(process.env.KTV_TEST_ACCESS, "utf8")).replace(
			/^\uFEFF/,
			"",
		),
	);
	const out =
		process.env.KTV_TEST_OUTPUT ||
		path.dirname(process.env.KTV_TEST_ACCESS);
	const checks = [],
		errors = [];
	async function api(route, token, method = "GET", data, expected = 200) {
		const r = await fetch("http://127.0.0.1:8080" + route, {
			method,
			headers: {
				"Content-Type": "application/json",
				...(token ? { "X-KTV-Token": token } : {}),
			},
			body: data === undefined ? undefined : JSON.stringify(data),
		});
		assert.equal(r.status, expected, route + " status");
		return r.json();
	}
	for (const url of [
		"/.local/access.json",
		"/%2elocal/access.json",
		"/.local/access.json?raw",
		"/@fs/D:/项目/新项目未完成/ktv/ktv/.local/access.json",
		"/.env",
	]) {
		const r = await fetch("http://127.0.0.1:5174" + url);
		assert.equal(r.status, 404, url);
	}
	checks.push("Private files blocked for plain, encoded, raw and @fs URLs");
	const admin = await api(
		"/ktv-api/sessions/staff",
		null,
		"POST",
		access.admin,
	);
	const customer = await api("/ktv-api/sessions/customer", null, "POST");
	const qr = await api("/ktv-api/rooms/A08/qr", admin.token, "POST");
	const unpaid = await api("/ktv-api/orders", customer.token, "POST", {
		room: "A08",
		scene: qr.scene,
		requestKey: "release-" + Date.now(),
		items: [{ id: "chicken", quantity: 1 }],
	});
	const browser = await chromium.launch({
		args: ["--renderer-process-limit=2"],
	});
	const context = await browser.newContext({
		viewport: { width: 1440, height: 1000 },
	});
	const pc = await context.newPage();
	const mobile = await browser.newContext({
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true,
	});
	const page = await mobile.newPage();
	for (const p of [pc, page]) {
		p.setDefaultTimeout(20000);
		p.on("pageerror", (e) => errors.push(e.message));
	}
	try {
		await pc.goto(
			(process.env.KTV_PC_URL || "http://127.0.0.1:5186") + "/login",
		);
		await pc.getByPlaceholder("账号").fill(access.pc.username);
		await pc
			.getByPlaceholder("密码", { exact: true })
			.fill(access.pc.password);
		await pc.getByRole("button", { name: /登.*录/ }).click();
		await pc.getByRole("heading", { name: "包厢餐食工作台" }).waitFor();
		await pc.getByRole("tab", { name: "餐品", exact: true }).click();
		await pc.getByText("宫保鸡丁饭", { exact: true }).waitFor();
		await pc.screenshot({
			path: path.join(out, "pc-operations.png"),
			fullPage: true,
		});
		await pc.getByRole("tab", { name: "包厢与点餐码" }).click();
		await pc
			.getByRole("button", { name: "网页码", exact: true })
			.first()
			.click();
		await pc.getByRole("link", { name: "保存二维码图片" }).waitFor();
		await pc.screenshot({
			path: path.join(out, "pc-qr.png"),
			fullPage: true,
		});
		await pc.keyboard.press("Escape");
		await pc.getByRole("dialog").waitFor({ state: "hidden" });
		await pc.getByRole("tab", { name: "操作日志" }).click();
		await pc.getByText("order.create", { exact: true }).first().waitFor();
		checks.push(
			"PC login, authenticated KTV workspace, products, QR dialog and audit records",
		);
		await page.goto("http://127.0.0.1:5174/#/");
		await page.evaluate(
			({ customer, access }) => {
				uni.setStorageSync("ktv-session-customer-v1", customer);
				uni.setStorageSync("ktv-customer-recovery", customer.recovery);
			},
			{ customer, access: null },
		);
		await page.goto(
			"http://127.0.0.1:5174/#/pages/customer/success?id=" + unpaid.id,
		);
		await page.reload();
		await page.getByText("尚未确认支付成功", { exact: true }).waitFor();
		assert.equal(
			await page.getByText("支付成功", { exact: true }).count(),
			0,
		);
		await page.screenshot({
			path: path.join(out, "unpaid-success-guard.png"),
			fullPage: true,
		});
		checks.push("Unpaid order cannot display payment success");
		await page.goto("http://127.0.0.1:5174/#/pages/admin/products");
		const screen = () => page.locator(".phone-screen:visible").last();
		await screen()
			.locator(".connection-gate input")
			.nth(0)
			.fill(access.admin.username);
		await screen()
			.locator(".connection-gate input")
			.nth(1)
			.fill(access.admin.password);
		await screen().locator(".connection-gate .primary-button").click();
		await screen().locator(".product-card").first().waitFor();
		await screen().getByText("新增", { exact: true }).click();
		await screen()
			.locator(".product-form input")
			.nth(0)
			.fill("回归餐品-" + Date.now());
		await screen().locator(".product-form input").nth(1).fill("12.30");
		const name = await screen()
			.locator(".product-form input")
			.nth(0)
			.inputValue();
		let blockRead = false;
		await page.route("**/ktv-api/state*", async (route) => {
			if (blockRead)
				await route.fulfill({
					status: 503,
					contentType: "application/json",
					body: '{"message":"回归测试：读取暂不可用"}',
				});
			else await route.continue();
		});
		await page.route("**/ktv-api/products/food-*", async (route) => {
			if (route.request().method() === "PUT") {
				const response = await route.fetch();
				blockRead = true;
				await route.fulfill({ response });
			} else await route.continue();
		});
		await screen().getByText("保存餐品", { exact: true }).click();
		await page.locator(".screen-16:visible").waitFor();
		assert.equal(
			(await api("/ktv-api/state", admin.token)).products.filter(
				(p) => p.name === name,
			).length,
			1,
		);
		blockRead = false;
		await page.unroute("**/ktv-api/state*");
		await page.unroute("**/ktv-api/products/food-*");
		await screen().getByText(name, { exact: true }).waitFor();
		checks.push(
			"Write success followed by failed read does not become duplicate product submission",
		);
		await screen().getByText("专属二维码", { exact: true }).count();
		assert.deepEqual(errors, []);
		await fs.writeFile(
			path.join(out, "release-browser-results.json"),
			JSON.stringify({ checks, errors }, null, 2),
		);
		console.log(JSON.stringify({ checks, errors }, null, 2));
	} catch (error) {
		console.error("Browser errors:", errors);
		console.error("PC URL:", pc.url());
		console.error((await pc.locator("body").innerText()).slice(0, 1800));
		await pc.screenshot({
			path: path.join(out, "release-failure.png"),
			fullPage: true,
		});
		throw error;
	} finally {
		await browser.close();
	}
}
main().catch((e) => {
	console.error(e.message);
	process.exitCode = 1;
});
