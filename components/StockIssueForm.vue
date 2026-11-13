<template>
	<view class="stock-report">
		<button v-if="!open" class="outline-button" @click="open = true">
			有缺货，反馈商家处理
		</button>
		<view v-else class="stock-form">
			<view class="between"
				><text class="bold">哪些餐品缺货？</text
				><button
					class="text-button"
					:disabled="connection.pending"
					@click="open = false"
				>
					收起
				</button></view
			>
			<text class="muted small"
				>提交后暂停本单备货，由商家转派、补货或退款。</text
			>
			<button
				v-for="item in order.items"
				:key="item.id"
				class="missing-item"
				role="checkbox"
				:aria-checked="selected.includes(item.id)"
				@click="toggle(item.id)"
			>
				<text class="missing-check">{{
					selected.includes(item.id) ? "☑" : "□"
				}}</text
				><text>{{ item.name }} × {{ item.quantity }}</text>
			</button>
			<textarea
				v-model="reason"
				maxlength="200"
				class="issue-reason"
				placeholder="说明缺货情况，例如：鸡丁饭只够 1 份，还差 2 份"
				aria-label="缺货情况"
			/>
			<text v-if="error" class="form-error">{{ error }}</text>
			<button
				class="primary-button"
				:disabled="
					connection.pending || !selected.length || !reason.trim()
				"
				@click="submit"
			>
				{{ connection.pending ? "提交中…" : "提交缺货反馈" }}
			</button>
		</view>
	</view>
</template>
<script setup>
import { ref, watch } from "vue";
import { reportStockIssue, connection } from "../common/store";
import { toast } from "../common/pages";
const props = defineProps({ order: Object });
const open = ref(false),
	selected = ref([]),
	reason = ref(""),
	error = ref("");
watch(
	() => props.order.id,
	() => {
		open.value = false;
		selected.value = [];
		reason.value = "";
		error.value = "";
	},
);
function toggle(id) {
	selected.value = selected.value.includes(id)
		? selected.value.filter((x) => x !== id)
		: [...selected.value, id];
}
async function submit() {
	if (connection.pending) return;
	error.value = "";
	try {
		await reportStockIssue(
			props.order,
			selected.value,
			reason.value.trim(),
		);
		open.value = false;
		toast("缺货已反馈，等待商家处理");
	} catch (e) {
		error.value = e.message;
	}
}
</script>
<style scoped>
.stock-report {
	margin: 16px 0;
}
.stock-form {
	display: flex;
	flex-direction: column;
	gap: 14px;
	padding: 16px;
	border: 1px solid var(--line);
	border-radius: 13px;
	background: var(--surface);
}
.missing-item {
	display: flex;
	align-items: center;
	gap: 10px;
	text-align: left;
	font-size: 15px;
	min-height: 44px;
}
.missing-check {
	font-size: 22px;
	color: var(--orange, #f57636);
}
.issue-reason {
	box-sizing: border-box;
	width: 100%;
	height: 96px;
	padding: 12px;
	border-radius: 9px;
	background: #f2f1ee;
	font-size: 14px;
	line-height: 1.6;
}
.stock-form .small {
	line-height: 1.6;
}
</style>
