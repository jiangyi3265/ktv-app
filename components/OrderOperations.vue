<template>
	<view class="card" v-if="order?.id">
		<view v-if="order.assignmentRequired" class="form-error"
			>已付款，当前没有可接单食堂，请分配食堂或处理退款。</view
		>
		<text class="card-heading">订单处理</text>
		<view v-if="order.status === 'stock_issue'" class="stock-detail"
			><text class="bold">备货方反馈缺货</text
			><text v-for="item in order.stockIssue?.items || []" :key="item.id"
				>{{ item.name }} × {{ item.quantity }}</text
			><text>{{ order.stockIssue?.reason }}</text
			><text class="muted small"
				>请选择转派、确认补货或全额退款，处理前暂停配送。</text
			></view
		>
		<button
			v-if="order.status === 'unpaid'"
			class="outline-button"
			@click="cancel"
		>
			取消未付款订单
		</button>
		<template
			v-if="
				['pending', 'preparing', 'delivering', 'stock_issue'].includes(
					order.status,
				)
			"
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
				placeholder="填写补货、转派或退款说明"
				maxlength="200"
			/>
			<button
				class="outline-button"
				:disabled="connection.pending"
				@click="transfer"
			>
				转派给所选食堂
			</button>
			<button
				v-if="order.status === 'stock_issue'"
				class="outline-button"
				:disabled="connection.pending"
				@click="resume"
			>
				已补齐货品，重新通知原备货方
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
					![
						'pending',
						'preparing',
						'delivering',
						'stock_issue',
					].includes(order.status)
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
	resumeStockOrder,
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
function resume() {
	if (!reason.value.trim()) {
		message.value = "请填写补货处理说明";
		return;
	}
	confirm("确认已补齐货品", () =>
		resumeStockOrder(props.order, reason.value),
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

<style scoped>
.stock-detail {
	display: flex;
	flex-direction: column;
	gap: 9px;
	margin-bottom: 16px;
	padding: 14px;
	background: #fff0e6;
	border-radius: 10px;
	font-size: 14px;
	line-height: 1.6;
	overflow-wrap: anywhere;
}
</style>
