<template>
	<view class="card" v-if="order?.id">
		<text class="card-heading">订单处理</text>
		<button
			v-if="order.status === 'unpaid'"
			class="outline-button"
			@click="cancel"
		>
			取消未付款订单
		</button>
		<template
			v-if="['pending', 'preparing', 'delivering'].includes(order.status)"
		>
			<picker
				:range="suppliers.map((a) => a.name + ' · ' + a.id)"
				@change="selected = Number($event.detail.value)"
				><view class="dialog-input">{{
					suppliers[selected]?.name || "选择接单食堂"
				}}</view></picker
			>
			<input
				v-model="reason"
				class="dialog-input"
				placeholder="填写转派或退款原因"
				maxlength="200"
			/>
			<button
				class="outline-button"
				:disabled="connection.pending"
				@click="transfer"
			>
				转派给所选食堂
			</button>
		</template>
		<template
			v-if="
				order.paid &&
				order.paymentMode === 'wechat' &&
				order.status !== 'refunded'
			"
		>
			<input
				v-if="
					!['pending', 'preparing', 'delivering'].includes(
						order.status,
					)
				"
				v-model="reason"
				class="dialog-input"
				placeholder="填写退款原因"
				maxlength="200"
			/>
			<button
				class="outline-button"
				:disabled="connection.pending"
				@click="refund"
			>
				{{
					order.status === "refunding"
						? "查询或重试退款"
						: "申请全额原路退款"
				}}
			</button>
		</template>
		<text v-if="message" class="form-error">{{ message }}</text>
	</view>
</template>
<script setup>
import { computed, ref } from "vue";
import {
	state,
	connection,
	cancelOrder,
	reassignOrder,
	refundOrder,
} from "../common/store";
const props = defineProps({ order: Object });
const selected = ref(0),
	reason = ref(""),
	message = ref("");
const suppliers = computed(() =>
	state.accounts.filter(
		(a) =>
			a.enabled &&
			a.process &&
			a.deliver &&
			a.id !== props.order.supplierId,
	),
);
async function run(action) {
	message.value = "";
	try {
		await action();
	} catch (e) {
		message.value = e.message;
	}
}
function confirm(title, action) {
	uni.showModal({
		title,
		content: "操作会同步到顾客和食堂，并记录操作日志。",
		success: (r) => {
			if (r.confirm) run(action);
		},
	});
}
function cancel() {
	confirm("取消未付款订单", () => cancelOrder(props.order.id));
}
function transfer() {
	if (!reason.value.trim() || !suppliers.value[selected.value]) {
		message.value = "请选择食堂并填写原因";
		return;
	}
	confirm("确认转派", () =>
		reassignOrder(
			props.order,
			suppliers.value[selected.value].id,
			reason.value,
		),
	);
}
function refund() {
	if (!reason.value.trim()) {
		message.value = "请填写退款原因";
		return;
	}
	confirm("确认全额退款", () => refundOrder(props.order, reason.value));
}
</script>
