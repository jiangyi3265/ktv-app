<template>
	<view
		v-if="!DESIGN_MODE && (state.orderPage > 1 || connection.hasMoreOrders)"
		class="between order-pagination"
		><button
			class="text-button"
			:disabled="state.orderPage <= 1 || busy"
			@click="turn(-1)"
		>
			上一页</button
		><text class="muted small">第 {{ state.orderPage }} 页 · 每页100笔</text
		><button
			class="text-button"
			:disabled="!connection.hasMoreOrders || busy"
			@click="turn(1)"
		>
			下一页
		</button></view
	>
</template>
<script setup>
import { ref } from "vue";
import {
	state,
	connection,
	DESIGN_MODE,
	changeOrderPage,
} from "../common/store";
const busy = ref(false);
async function turn(delta) {
	busy.value = true;
	try {
		await changeOrderPage(state.orderPage + delta);
	} catch (e) {
		uni.showToast({ title: e.message, icon: "none" });
	} finally {
		busy.value = false;
	}
}
</script>
<style scoped>
.order-pagination {
	padding: 18px 0;
	gap: 8px;
}
</style>
