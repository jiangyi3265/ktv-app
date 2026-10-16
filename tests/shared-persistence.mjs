import assert from "node:assert/strict";
import fs from "node:fs/promises";
const root = new URL("../", import.meta.url);
const access = JSON.parse(
	(await fs.readFile(new URL(".local/access.json", root), "utf8")).replace(
		/^\uFEFF/,
		"",
	),
);
const base = "http://127.0.0.1:8080/ktv-api";
const login = await fetch(base + "/sessions/staff", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify(access.admin),
});
assert.equal(login.status, 200);
const admin = await login.json();
const headers = {
	"X-KTV-Token": admin.token,
	"Content-Type": "application/json",
};
const state = await (await fetch(base + "/state", { headers })).json();
for (const file of ["shared-api-result.json", "shared-browser-report.json"]) {
	const expected = JSON.parse(
		await fs.readFile(new URL("qa/" + file, root), "utf8"),
	);
	const order = state.orders.find((o) => o.id === expected.orderId);
	assert(order);
	assert.equal(order.status, "completed");
	assert.equal(order.totalCents, 8600);
}
const resilience = JSON.parse(
	await fs.readFile(
		new URL("qa/shared-resilience-report.json", root),
		"utf8",
	),
);
assert(state.rooms.some((r) => r.id === resilience.roomId && r.bound));
assert(state.accounts.some((a) => a.name.startsWith("联调账号 ")));
const form = new FormData();
form.append(
	"file",
	new Blob(
		[await fs.readFile(new URL("static/food/base-chicken.png", root))],
		{ type: "image/png" },
	),
	"food.png",
);
const upload = await fetch(base + "/images", {
	method: "POST",
	headers: { "X-KTV-Token": admin.token },
	body: form,
});
assert.equal(upload.status, 200);
const { url } = await upload.json();
const product = state.products.find((p) => p.id === "chicken");
const changed = await fetch(base + "/products/chicken", {
	method: "PUT",
	headers,
	body: JSON.stringify({ ...product, customImage: url }),
});
assert.equal(changed.status, 200);
try {
	const guest = await (
		await fetch(base + "/sessions/customer", { method: "POST" })
	).json();
	const menu = await (
		await fetch(base + "/state", {
			headers: { "X-KTV-Token": guest.token },
		})
	).json();
	assert.equal(
		menu.products.find((p) => p.id === "chicken").customImage,
		url,
	);
	const image = await fetch("http://127.0.0.1:5174" + url);
	assert.equal(image.status, 200);
	assert.match(image.headers.get("content-type"), /image\/png/);
	await fetch(base + "/session", {
		method: "DELETE",
		headers: { "X-KTV-Token": guest.token },
	});
} finally {
	const latest = await (await fetch(base + "/state", { headers })).json();
	const p = latest.products.find((p) => p.id === "chicken");
	assert.equal(
		(
			await fetch(base + "/products/chicken", {
				method: "PUT",
				headers,
				body: JSON.stringify({
					...p,
					customImage: product.customImage || "",
				}),
			})
		).status,
		200,
	);
	await fetch(base + "/session", { method: "DELETE", headers });
}
console.log(
	"PASS: backend restart preserved orders, rooms, accounts; uploaded photo readable from another client.",
);
