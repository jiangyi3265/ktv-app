<template>
	<AppShell :page="page" title="确认订单" back-to="01">
		<view class="page-body">
			<button class="destination" :disabled="state.roomLoading || paying" @click="!paymentOrder && scanRoomCode()"
				><AppIcon name="map-pin" filled color="white" :size="37" /><view
					class="fill stack"
					><text class="destination-title"
						>{{ state.roomLoading ? '正在识别包厢…' : destinationRoom ? destinationRoom + ' 包厢' : '请先扫描包厢码' }}</text
					><text class="small">{{ destinationRoom ? '餐食将送到当前包厢' : '点击扫描包厢专属点餐码' }}</text></view
				><AppIcon v-if="!paymentOrder" name="chevron-right" color="white" :size="23"
			/></button>
			<view v-if="items.length" class="card"
				><ItemList :items="items"
			/></view>
			<view v-else class="card empty-state"
				><text>请先选择喜欢的餐品</text
				><button class="primary-button" @click="go('01')">
					去点餐
				</button></view
			>
			<view class="card checkout-total"
				><view class="between"
					><text>餐品合计</text
					><text class="bold"
						><text class="price-currency">¥</text>{{ total }}</text
					></view
				><view class="price-line"
					><text>实付款</text
					><text class="price"
						><text class="price-currency">¥</text>{{ total }}</text
					></view
				></view
			>
			<view class="card payment-choice"
				><view class="wechat-icon"
					><AppIcon
						name="brand-wechat"
						color="white"
						:size="28" /></view
				><text class="fill bold">微信支付</text
				><view class="payment-selected"
					><AppIcon name="check" color="white" :size="14" /></view
			></view>
			<text class="payment-recipient">收款方：KTV 商户</text>
		</view>
		<template #footer
			><view class="checkout-dock"
				><text class="price"
					><text class="price-currency">¥</text>{{ total }}</text
				><button
					class="primary-button"
					:disabled="!items.length || alreadyPaid || closed || paying || state.roomLoading"
					@click="openPayment"
				>
					{{ alreadyPaid ? '已付款' : closed ? '订单已关闭' : paying ? '正在处理…' : state.roomLoading ? '正在识别…' : !DESIGN_MODE && !destinationRoom ? '先扫码选包厢' : '确认并支付' }}
				</button></view
			></template
		>

	</AppShell>
</template>
<script setup>
import { computed, ref, provide } from "vue";
provide("artboard", 1);
import AppShell from "../components/AppShell.vue";
import AppIcon from "../components/AppIcon.vue";
import ItemList from "../components/ItemList.vue";
import {
	state,
	cartItems,
	activeOrder,
	createUnpaidOrder,
	DESIGN_MODE,
	scanRoomCode,
} from "../common/store";
import { money, totalCents } from "../common/domain.mjs";
import { go } from "../common/pages";
import { usePayment } from "../common/usePayment";
const props = defineProps({ page: String, query: Object });
provide(
	"referencePage",
	computed(() => props.page),
);
const { paying, pay } = usePayment();
const submittedId = ref("");
const paymentOrder = computed(() => {
 const id = props.query?.id || submittedId.value;
 if (id) return state.orders.find(order => order.id === id) || (state.orderDetail?.id === id ? state.orderDetail : null);
 return props.page === "04" && activeOrder.value.status === "unpaid" ? activeOrder.value : null;
});
const closed = computed(() => paymentOrder.value && paymentOrder.value.status !== "unpaid" && !paymentOrder.value.paid);
const alreadyPaid = computed(() => Boolean(paymentOrder.value?.paid));
const destinationRoom = computed(() => paymentOrder.value?.room || state.room);
const items = computed(() =>
	(props.query?.id || submittedId.value || paymentOrder.value)
		? paymentOrder.value?.items || []
		: cartItems.value,
);
const total = computed(() => money(totalCents(items.value)));
async function openPayment() {
 if (paying.value) return;
 if (!paymentOrder.value && !DESIGN_MODE && !state.room) { await scanRoomCode(); return; }
 await pay(async () => {
  if (props.query?.id || submittedId.value || paymentOrder.value) return paymentOrder.value;
  const order = await createUnpaidOrder();
  submittedId.value = order.id;
  return order;
 });
}
</script>
