import test from "node:test";
import assert from "node:assert/strict";
import {
	totalCents,
	money,
	setQuantity,
	transitionOrder,
	supplierOrder,
} from "../common/domain.mjs";

test("cart quantities produce the approved ¥86 total without floating-point currency errors", () => {
	assert.equal(
		totalCents([
			{ price: 32, quantity: 2 },
			{ price: 22, quantity: 1 },
		]),
		8600,
	);
	assert.equal(
		totalCents([
			{ price: 0.1, quantity: 3 },
			{ price: 0.2, quantity: 1 },
		]),
		50,
	);
	assert.equal(money(8600), "86");
	assert.equal(money(8650), "86.50");
	assert.deepEqual(setQuantity({ chicken: 2 }, "chicken", 0), {});
	assert.deepEqual(setQuantity({}, "chicken", -1), {});
	assert.deepEqual(setQuantity({}, "chicken", 1000), { chicken: 99 });
});

test("unpaid orders cannot be prepared or completed; delivery staff completes the flow", () => {
	const unpaid = { id: "1", status: "unpaid", paid: false };
	assert.throws(() => transitionOrder(unpaid, "preparing"));
	assert.throws(() => transitionOrder(unpaid, "completed"));
	let order = unpaid;
	for (const status of ["pending", "preparing", "delivering", "completed"])
		order = transitionOrder(order, status);
	assert.equal(order.paid, true);
	assert.equal(order.status, "completed");
	assert.throws(() => transitionOrder(order, "pending"));
});

test("supplier projection excludes money/contact fields and other suppliers/unpaid orders", () => {
	const order = {
		id: "1",
		room: "A08",
		status: "pending",
		paid: true,
		supplierId: "A01",
		time: "21:08",
		phone: "private",
		amount: 86,
		items: [
			{
				id: "a",
				name: "宫保鸡丁饭",
				price: 32,
				quantity: 2,
				image: "chicken",
			},
		],
	};
	assert.equal(supplierOrder(order, "A02"), null);
	assert.equal(supplierOrder({ ...order, paid: false }, "A01"), null);
	const visible = supplierOrder(order, "A01");
	assert.equal(visible.items[0].quantity, 2);
	assert.equal("phone" in visible, false);
	assert.equal("amount" in visible, false);
	assert.equal("price" in visible.items[0], false);
});
