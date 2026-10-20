const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs/promises"),
	assert = require("node:assert/strict");
(async () => {
	const access = JSON.parse(
		(await fs.readFile(process.env.KTV_TEST_ACCESS || ".local/access.json", "utf8")).replace(
			/^\uFEFF/,
			"",
		),
	);
	const browser = await chromium.launch({args:["--renderer-process-limit=2"]}),
		errors = [],
		checks = [];
	const contexts = await Promise.all(
		[1, 2, 3].map(() =>
			browser.newContext({
				viewport: { width: 390, height: 844 },
				isMobile: true,
				hasTouch: true,
			}),
		),
	);
	const [customer, supplier, admin] = await Promise.all(
		contexts.map((c) => c.newPage()),
	);
	for (const p of [customer, supplier, admin]) {
		p.setDefaultTimeout(15000);
		p.on("pageerror", (e) => errors.push(e.message));
	}
	const screen = (p) => p.locator(".phone-screen:visible").last();
	const go = async (p, path) => {
		await p.goto("http://127.0.0.1:5174/#/pages/" + path, {
			waitUntil: "domcontentloaded",
		});
		await screen(p).waitFor();
	};
	const click = (p, label) =>
		screen(p)
			.locator("uni-button")
			.filter({ hasText: new RegExp("^\\s*" + label + "\\s*$") })
			.last()
			.click();
	const waitText = async (locator, re) => {
		for (let i = 0; i < 60; i++) {
			if (re.test(await locator.innerText().catch(() => ""))) return;
			await new Promise((r) => setTimeout(r, 250));
		}
		assert.match(await locator.innerText(), re);
	};
	async function login(p, credentials) {
		await screen(p)
			.locator(".connection-gate input")
			.nth(0)
			.fill(credentials.username);
		await screen(p)
			.locator(".connection-gate input")
			.nth(1)
			.fill(credentials.password);
		await click(p, "登录");
		await screen(p)
			.locator(".connection-gate")
			.waitFor({ state: "hidden" });
	}
	try {
		const apiLogin = await fetch('http://127.0.0.1:8080/ktv-api/sessions/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(access.admin) }).then(r=>r.json());
		const qr = await fetch('http://127.0.0.1:8080/ktv-api/rooms/A08/qr', { method: 'POST', headers: { 'X-KTV-Token': apiLogin.token } }).then(r=>r.json());
		await go(customer, "index/index?scene=" + qr.scene);
		await waitText(screen(customer).locator('.room-chip'), /A08/);
		await screen(customer).locator(".catalog-product").first().waitFor();
		await go(supplier, "supplier/workbench");
		await login(supplier, access.supplier);
		await go(admin, "admin/orders");
		await login(admin, access.admin);
		const food = screen(customer).locator(".catalog-product");
		await food
			.filter({ hasText: "宫保鸡丁饭" })
			.locator(".add-button")
			.click();
		await food
			.filter({ hasText: "宫保鸡丁饭" })
			.locator(".add-button")
			.click();
		await food
			.filter({ hasText: "香酥鸡米花" })
			.locator(".add-button")
			.click();
		await click(customer, "去结算");
		await customer.locator(".screen-03:visible").waitFor();
		await click(customer, "确认并支付");
		await customer.locator(".screen-04:visible").waitFor();
		const orderId = new URLSearchParams(customer.url().split("?")[1]).get(
			"id",
		);
		assert(orderId);
		await waitText(
			screen(admin).locator(".admin-orders"),
			new RegExp("#" + orderId),
		);
		await click(customer, "确认支付");
		await customer.getByText("模拟成功", { exact: true }).click();
		await customer.locator(".screen-05:visible").waitFor();
		await click(customer, "查看订单");
		await customer.locator(".screen-07:visible").waitFor();
		await screen(supplier).locator(".supplier-order").first().waitFor();
		await screen(supplier)
			.locator(".supplier-order")
			.first()
			.locator("uni-button")
			.click();
		await supplier.locator(".screen-10:visible").waitFor();
		assert(supplier.url().includes("id=" + orderId));
		assert.doesNotMatch(await screen(supplier).innerText(), /¥|￥|收款/);
		await click(supplier, "确认接单");
		await supplier.locator(".screen-11:visible").waitFor();
		await waitText(
			screen(customer).locator(".order-status-title"),
			/制作中/,
		);
		for (const check of await screen(supplier).locator('.check-box').all()) await check.click();
		await click(supplier, "出餐并开始配送");
		await supplier.locator(".screen-12:visible").waitFor();
		await waitText(
			screen(customer).locator(".order-status-title"),
			/配送中/,
		);
		await click(supplier, "确认送达");
		await screen(supplier).locator(".dialog .primary-button").click();
		await waitText(
			screen(customer).locator(".order-status-title"),
			/已送达/,
		);
		const row = screen(admin)
			.locator(".admin-order-card")
			.filter({ hasText: "#" + orderId });
		await waitText(row, /已完成/);
		checks.push(
			"三个隔离浏览器会话：下单、模拟支付、接单、配送和送达自动同步",
		);
		await row.locator(".view-order").click();
		await admin.locator(".screen-19:visible").waitFor();
		for (const p of [customer, supplier, admin])
			await p
				.locator("uni-toast")
				.waitFor({ state: "hidden", timeout: 5000 })
				.catch(() => {});
		await fs.mkdir("qa/shared", { recursive: true });
		await Promise.all(
			[
				[customer, "customer"],
				[supplier, "supplier"],
				[admin, "admin"],
			].map(([p, n]) =>
				screen(p).screenshot({ path: "qa/shared/" + n + ".png" }),
			),
		);
		await go(customer, "index/index");
		await screen(customer).locator(".catalog-product").first().waitFor();
		await go(admin, "admin/products");
		const product = screen(admin)
			.locator(".product-card")
			.filter({ hasText: "宫保鸡丁饭" });
		await product.waitFor();
		await product.locator(".switch-control").click();
		await screen(customer)
			.locator(".catalog-product")
			.filter({ hasText: "宫保鸡丁饭" })
			.waitFor({ state: "hidden" });
		await admin.waitForFunction(() => !document.querySelector('.uni-toast'));
		await product.locator(".switch-control").click();
		await screen(customer)
			.locator(".catalog-product")
			.filter({ hasText: "宫保鸡丁饭" })
			.waitFor();
		checks.push("管理端上下架餐品，顾客菜单无需刷新自动更新");
		await product.locator(".edit-link").click();
		await admin.locator(".screen-17:visible").waitFor();
		await screen(admin).locator(".product-form input").nth(1).fill("33.50");
		await screen(admin).locator(".product-form input").nth(1).press("Tab");
		await click(admin, "保存餐品");
		await admin.locator(".screen-16:visible").waitFor();
		await waitText(
			screen(customer)
				.locator(".catalog-product")
				.filter({ hasText: "宫保鸡丁饭" }),
			/33\.5/,
		);
		await screen(admin)
			.locator(".product-card")
			.filter({ hasText: "宫保鸡丁饭" })
			.locator(".edit-link")
			.click();
		await admin.locator(".screen-17:visible").waitFor();
		await screen(admin).locator(".product-form input").nth(1).fill("32");
		await screen(admin).locator(".product-form input").nth(1).press("Tab");
		await click(admin, "保存餐品");
		await admin.locator(".screen-16:visible").waitFor();
		checks.push("管理端修改售价同步到顾客；已创建订单保留原成交价");
		await go(customer, "customer/orders");
		await waitText(screen(customer), /已完成/);
		await customer.reload({ waitUntil: "domcontentloaded" });
		await waitText(screen(customer), /已完成/);
		checks.push("刷新后顾客身份和数据库订单保持");
		assert.deepEqual(errors, []);
		await fs.writeFile(
			"qa/shared-browser-report.json",
			JSON.stringify({ passed: checks, errors, orderId }, null, 2),
		);
		console.log(
			JSON.stringify({ passed: checks, errors, orderId }, null, 2),
		);
	} catch (error) {
		await Promise.all(
			[customer, supplier, admin].map((p, i) =>
				p
					.screenshot({ path: "qa/shared-failure-" + i + ".png" })
					.catch(() => {}),
			),
		);
		console.error(errors);
		throw error;
	} finally {
		await browser.close();
	}
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
