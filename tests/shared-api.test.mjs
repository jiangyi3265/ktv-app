import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const base = process.env.KTV_TEST_API || "http://127.0.0.1:8080/ktv-api";
const access = JSON.parse(
	(
		await fs.readFile(
			process.env.KTV_TEST_ACCESS || new URL("../.local/access.json", import.meta.url),
			"utf8",
		)
	).replace(/^\uFEFF/, ""),
);
async function call(path, { token, method = "GET", data, status = 200 } = {}) {
	const response = await fetch(base + path, {
		method,
		headers: {
			"Content-Type": "application/json",
			...(token ? { "X-KTV-Token": token } : {}),
		},
		body: data === undefined ? undefined : JSON.stringify(data),
	});
	const body = await response.json();
	assert.equal(response.status, status, JSON.stringify(body));
	return body;
}
test("shared API: ownership, supplier privacy, transitions, concurrency and persistence", async () => {
	const customer = await call("/sessions/customer", { method: "POST" }),
		other = await call("/sessions/customer", { method: "POST" });
	const admin = await call("/sessions/staff", {
			method: "POST",
			data: access.admin,
		}),
		supplier = await call("/sessions/staff", {
			method: "POST",
			data: access.supplier,
		});
	const initial = await call("/state", { token: admin.token });
	const qr = await call('/rooms/A08/qr', { token: admin.token, method: 'POST' });
	assert(!JSON.stringify(initial).includes("passwordHash"));
	await call("/state", { status: 401 });
	const data = {
		room: "A08",
		scene: qr.scene,
		requestKey: "api-" + Date.now(),
		items: [
			{ id: "chicken", quantity: 2 },
			{ id: "bites", quantity: 1 },
		],
		totalCents: 1,
		customerId: "forged",
		paid: true,
	};
	const created = await call("/orders", {
		method: "POST",
		token: customer.token,
		data,
	});
	const duplicate = await call("/orders", {
		method: "POST",
		token: customer.token,
		data,
	});
	assert.equal(duplicate.id, created.id);
	let snapshot = await call("/state", { token: customer.token }),
		order = snapshot.orders.find((o) => o.id === created.id);
	assert.equal(order.totalCents, 8600);
	assert.equal(order.paid, false);
	assert.equal(order.customerId, customer.subject);
	assert(
		!(await call("/state", { token: other.token })).orders.some(
			(o) => o.id === order.id,
		),
	);
	await call("/orders/" + order.id + "/pay-demo", {
		method: "POST",
		token: other.token,
		status: 403,
	});
	assert(
		!(await call("/state", { token: supplier.token })).orders.some(
			(o) => o.id === order.id,
		),
	);
	await call("/orders/" + order.id + "/pay-demo", {
		method: "POST",
		token: customer.token,
	});
	await call("/orders/" + order.id + "/pay-demo", {
		method: "POST",
		token: customer.token,
	});
	const food = await call("/state", { token: supplier.token });
	assert(food.orders.some((o) => o.id === order.id));
	for (const key of [
		"totalCents",
		"customerId",
		"price",
		"paid",
		"passwordHash",
		"adminHash",
	])
		assert(
			!JSON.stringify(food).includes('"' + key + '"'),
			key + " leaked",
		);
	await call("/orders/" + order.id + "/transition", {
		method: "POST",
		token: customer.token,
		data: { status: "preparing" },
		status: 403,
	});
	await call("/orders/" + order.id + "/transition", {
		method: "POST",
		token: supplier.token,
		data: { status: "completed" },
		status: 409,
	});
	await call("/orders/" + order.id + "/transition", {
		method: "POST",
		token: supplier.token,
		data: { status: "preparing" },
	});
	await call("/orders/" + order.id + "/transition", {
		method: "POST",
		token: supplier.token,
		data: { status: "delivering", checkedIds: ["chicken"] },
		status: 400,
	});
	await call("/orders/" + order.id + "/transition", {
		method: "POST",
		token: supplier.token,
		data: { status: "delivering", checkedIds: ["chicken", "bites"] },
	});
	const account = (
		await call("/state", { token: admin.token })
	).accounts.find((a) => a.id === "A01");
	try {
		await call("/accounts/A01", {
			method: "PUT",
			token: admin.token,
			data: { ...account, deliver: false },
			status: 409,
		});
		assert.equal((await call('/state', { token: supplier.token })).accounts[0].deliver, true);
	} finally {
		const latest = (
			await call("/state", { token: admin.token })
		).accounts.find((a) => a.id === "A01");
		await call("/accounts/A01", {
			method: "PUT",
			token: admin.token,
			data: { ...latest, deliver: account.deliver },
		});
	}
	await call("/orders/" + order.id + "/transition", {
		method: "POST",
		token: supplier.token,
		data: { status: "completed" },
	});
	assert.equal(
		(await call("/state", { token: customer.token })).orders.find(
			(o) => o.id === order.id,
		).status,
		"completed",
	);
	const complete = (await call("/state", { token: admin.token })).orders.find(
		(o) => o.id === order.id,
	);
	assert.equal(complete.events.length, 5);
	assert.equal(complete.totalCents, 8600);
	const product = (await call("/state", { token: admin.token })).products[0];
	await call("/products/" + product.id, {
		method: "PUT",
		token: customer.token,
		data: product,
		status: 403,
	});
	await call("/products/" + product.id, {
		method: "PUT",
		token: admin.token,
		data: product,
	});
	await call("/products/" + product.id, {
		method: "PUT",
		token: admin.token,
		data: product,
		status: 409,
	});
	await call("/orders", {
		method: "POST",
		token: customer.token,
		data: {
			...data,
			requestKey: "bad",
			items: [{ id: "chicken", quantity: -1 }],
		},
		status: 400,
	});
	await call("/orders", {
		method: "POST",
		token: customer.token,
		data: { ...data, requestKey: "bad-room", room: "B05" },
		status: 409,
	});
	await fs.mkdir(new URL("../qa/", import.meta.url), { recursive: true });
	await fs.writeFile(
		new URL("../qa/shared-api-result.json", import.meta.url),
		JSON.stringify(
			{ orderId: order.id, status: "passed", checks: 20 },
			null,
			2,
		),
	);
	for (const session of [customer, other, admin, supplier])
		await call("/session", { method: "DELETE", token: session.token });
});
