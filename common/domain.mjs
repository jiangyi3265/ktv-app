export const STATUS = {
	unpaid: "待付款",
	pending: "待接单",
	preparing: "制作中",
	delivering: "配送中",
	completed: "已完成",
};

export function totalCents(items) {
	return items.reduce(
		(sum, item) =>
			sum + Math.round(Number(item.price) * 100) * item.quantity,
		0,
	);
}

export function money(cents) {
	return Number.isInteger(cents / 100)
		? String(cents / 100)
		: (cents / 100).toFixed(2);
}

export function setQuantity(cart, id, quantity) {
	const next = { ...cart };
	const safeQuantity = Math.max(
		0,
		Math.min(99, Math.trunc(Number(quantity) || 0)),
	);
	if (safeQuantity === 0) delete next[id];
	else next[id] = safeQuantity;
	return next;
}

export function transitionOrder(order, nextStatus) {
	const allowed = {
		unpaid: "pending",
		pending: "preparing",
		preparing: "delivering",
		delivering: "completed",
	};
	if (allowed[order.status] !== nextStatus)
		throw new Error("当前订单不能执行此操作");
	return { ...order, status: nextStatus, paid: nextStatus !== "unpaid" };
}

// Field allow-list: supplier UI never receives payment amounts or customer data.
export function supplierOrder(order, accountId) {
	if (!order.paid || order.supplierId !== accountId) return null;
	return {
		id: order.id,
		room: order.room,
		status: order.status,
		time: order.time,
		items: order.items.map(({ id, name, quantity, image }) => ({
			id,
			name,
			quantity,
			image,
		})),
	};
}
