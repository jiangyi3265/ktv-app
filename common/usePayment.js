import { ref } from "vue";
import { DESIGN_MODE, connection, state, payWechat, completeDemoPayment } from "./store";
import { go, toast } from "./pages";

// Shared lock also covers multiple cached pages and repeated taps.
let paying;
export function usePayment() {
	paying ||= ref(false);
	async function pay(resolveOrder) {
		if (paying.value) return;
		paying.value = true;
		try {
			if (!DESIGN_MODE && !connection.wechatPayment && !connection.demoPayment)
				throw new Error("尚未配置微信支付，请联系 KTV");
			const order = await resolveOrder();
			if (!order?.id) throw new Error("订单尚未加载，请稍后重试");
			if (order.paid) { go("07", { id: order.id }); return; }
			if (order.status !== "unpaid") throw new Error("订单已关闭，请重新点餐");
			if (!DESIGN_MODE && connection.wechatPayment) {
				await payWechat(order.id);
			} else {
				const confirmed = await new Promise((resolve) => uni.showModal({
					title: "演示支付", content: "不会发起微信扣款。是否模拟支付成功？",
					confirmText: "模拟成功", success: (r) => resolve(r.confirm), fail: () => resolve(false),
				}));
				if (!confirmed) return;
				state.activeOrderId = order.id;
				await completeDemoPayment(order.id);
			}
			go("05", { id: order.id });
		} catch (error) { toast(error.message || "支付未完成，请查看订单后重试"); }
		finally { paying.value = false; }
	}
	return { paying, pay };
}
