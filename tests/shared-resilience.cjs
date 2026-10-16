const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs/promises"),
	assert = require("node:assert/strict");
(async () => {
	const access = JSON.parse(
		(await fs.readFile(".local/access.json", "utf8")).replace(
			/^\uFEFF/,
			"",
		),
	);
	const browser = await chromium.launch(),
		contexts = await Promise.all(
			[1, 2].map(() =>
				browser.newContext({ viewport: { width: 390, height: 844 } }),
			),
		),
		[admin, customer] = await Promise.all(contexts.map((c) => c.newPage()));
	const errors = [];
	for (const p of [admin, customer]) {
		p.setDefaultTimeout(15000);
		p.on("pageerror", (e) => errors.push(e.message));
	}
	const screen = (p) => p.locator(".phone-screen:visible").last(),
		go = (p, route) =>
			p.goto("http://127.0.0.1:5174/#/pages/" + route, {
				waitUntil: "domcontentloaded",
			});
	const click = (p, label) =>
		screen(p)
			.locator("uni-button")
			.filter({ hasText: new RegExp("^\\s*" + label + "\\s*$") })
			.last()
			.click();
	const api = async (path, token, method = "GET", data) => {
		const r = await fetch("http://127.0.0.1:8080/ktv-api" + path, {
			method,
			headers: {
				"Content-Type": "application/json",
				"X-KTV-Token": token || "",
			},
			body: data ? JSON.stringify(data) : undefined,
		});
		const result = await r.json();
		assert.equal(r.status, 200, JSON.stringify(result));
		return result;
	};
	let supplierSession, initialAccount, adminSession, roomId;
	try {
		adminSession = await api("/sessions/staff", null, "POST", access.admin);
		await go(admin, "admin/rooms");
		await screen(admin)
			.locator(".connection-gate input")
			.first()
			.fill(access.admin.username);
		await screen(admin)
			.locator(".connection-gate input")
			.nth(1)
			.fill(access.admin.password);
		await click(admin, "登录");
		await screen(admin).locator(".room-card").first().waitFor();
		roomId = "T" + String(Date.now()).slice(-8);
		await click(admin, "新增");
		await screen(admin).locator(".dialog input").fill(roomId);
		await click(admin, "保存包厢");
		await screen(admin)
			.locator(".room-card")
			.filter({ hasText: roomId })
			.waitFor();
		await screen(admin)
			.locator(".room-card")
			.filter({ hasText: roomId })
			.locator("uni-button")
			.filter({ hasText: "生成并绑定" })
			.click();
		await admin.locator(".screen-15:visible").waitFor();
		await go(customer, "index/index?room=" + roomId);
		await screen(customer).locator(".catalog-product").first().waitFor();
		assert.match(
			await screen(customer).locator(".room-chip").innerText(),
			new RegExp(roomId),
		);
		const guestSession = await api("/sessions/customer", null, "POST");
		// Reach the public room list through the customer session to prove this is shared server data.
		assert(
			(await api("/state", guestSession.token)).rooms.some(
				(r) => r.id === roomId,
			),
		);
		await api("/session", guestSession.token, "DELETE");
		await contexts[1].setOffline(true);
		await screen(customer)
			.locator(".sync-warning")
			.waitFor({ timeout: 20000 });
		await contexts[1].setOffline(false);
		await screen(customer)
			.locator(".sync-warning")
			.waitFor({ state: "hidden", timeout: 20000 });
		await go(admin, "admin/permissions");
		await screen(admin).locator(".permission-card").first().waitFor();
		initialAccount = (
			await api("/state", adminSession.token)
		).accounts.find((a) => a.id === "A01");
		await screen(admin).locator('[aria-label="确认送达权限"]').click();
		await click(admin, "保存设置");
		for (let i = 0; i < 30; i++) {
			const a = (await api("/state", adminSession.token)).accounts.find(
				(a) => a.id === "A01",
			);
			if (a.deliver !== initialAccount.deliver) break;
			await new Promise((r) => setTimeout(r, 100));
		}
		supplierSession = await api(
			"/sessions/staff",
			null,
			"POST",
			access.supplier,
		);
		assert.equal(
			(await api("/state", supplierSession.token)).accounts[0].deliver,
			!initialAccount.deliver,
		);
		await screen(admin).locator('[aria-label="确认送达权限"]').click();
		await click(admin, "保存设置");
		const newSecret = require("node:crypto").randomBytes(24).toString("base64url");
		const account = await api("/accounts", adminSession.token, "POST", {
			name: "联调账号 " + Date.now(),
			password: newSecret,
			enabled: true,
			process: true,
			deliver: true,
		});
		assert(account.id);
		const secondSupplier = await api("/sessions/staff", null, "POST", {
			username: account.id,
			password: newSecret,
		});
		assert.equal(
			(await api("/state", secondSupplier.token)).orders.length,
			0,
		);
		await api("/session", secondSupplier.token, "DELETE");
		const created = (await api("/state", adminSession.token)).accounts.find(
			(a) => a.id === account.id,
		);
		await api("/accounts/" + account.id, adminSession.token, "PUT", {
			...created,
			enabled: false,
		});
		await fs.writeFile(
			"qa/shared-resilience-report.json",
			JSON.stringify({ roomId, accountId: account.id, passed: true }),
		);
		assert.deepEqual(errors, []);
		console.log(
			JSON.stringify(
				{
					passed: [
						"包厢新增与绑定同步到扫码入口",
						"断网提示与自动恢复",
						"管理端权限保存同步到食堂会话",
						"新增外包账号持久保存",
					],
					errors,
					roomId,
				},
				null,
				2,
			),
		);
	} finally {
		if (initialAccount && adminSession) {
			const latest = (
				await api("/state", adminSession.token)
			).accounts.find((a) => a.id === "A01");
			await api("/accounts/A01", adminSession.token, "PUT", {
				...latest,
				deliver: initialAccount.deliver,
			});
		}
		if (adminSession) await api("/session", adminSession.token, "DELETE");
		if (supplierSession)
			await api("/session", supplierSession.token, "DELETE");
		await browser.close();
	}
})().catch((e) => {
	console.error(e);
	process.exitCode = 1;
});
