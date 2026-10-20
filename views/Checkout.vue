<template>
	<AppShell :page="page" title="确认订单" back-to="01">
		<view class="page-body">
			<view class="destination"
				><AppIcon name="map-pin" filled color="white" :size="37" /><view
					class="fill stack"
					><text class="destination-title"
						>{{ destinationRoom }} 包厢</text
					><text class="small">餐食将送到当前包厢</text></view
				><AppIcon name="chevron-right" color="white" :size="23"
			/></view>
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
					:disabled="!items.length || alreadyPaid"
					@click="openPayment"
				>
					确认并支付
				</button></view
			></template
		>
		<template #overlay>
			<view v-if="page === '04'" class="overlay">
				<view class="bottom-sheet payment-sheet">
					<view class="payment-sheet-heading"
						><button
							class="icon-button"
							aria-label="关闭支付"
							@click="back('03')"
						>
							<AppIcon name="x" /></button
						><text>微信支付</text></view
					>
					<text class="payment-merchant">KTV 商户</text
					><text class="payment-value"
						><text class="payment-currency">¥</text
						>{{ Number(total).toFixed(2) }}</text
					>
					<view class="payment-source"
						><text class="muted">支付方式</text
						><view class="row"
							><AppIcon
								name="coin"
								color="yellow"
								:size="21" /><text>零钱</text
							><AppIcon
								name="chevron-right"
								color="gray"
								:size="19" /></view
					></view>
					<button
						class="wechat-button"
						:disabled="paying || !items.length"
						@click="pay"
					>
						{{
							alreadyPaid
								? "查看订单"
								: paying
									? "正在处理…"
									: "确认支付"
						}}</button
					><text class="payment-caption">{{
						alreadyPaid
							? "该订单已支付，请勿重复付款"
							: "包厢餐食订单"
					}}</text>
				</view>
			</view>
		</template>
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
	completeDemoPayment,
	DESIGN_MODE,
	connection,
	payWechat,
} from "../common/store";
import { money, totalCents } from "../common/domain.mjs";
import { go, back, toast } from "../common/pages";
const props = defineProps({ page: String, query: Object });
provide(
	"referencePage",
	computed(() => props.page),
);
const paying = ref(false);
const paymentOrder = computed(() => {
	if (props.page !== "04") return null;
	if (props.query?.id) {
		return (
			state.orders.find(
				(order) =>
					order.id === props.query.id &&
					order.customerId === state.customerId,
			) || (state.orderDetail?.id === props.query.id ? state.orderDetail : null)
		);
	}
	return activeOrder.value.status === "unpaid" &&
		activeOrder.value.customerId === state.customerId
		? activeOrder.value
		: null;
});
const alreadyPaid = computed(() => Boolean(paymentOrder.value?.paid));
const destinationRoom = computed(() => paymentOrder.value?.room || state.room);
const items = computed(() =>
	props.page === "04" && (props.query?.id || paymentOrder.value)
		? paymentOrder.value?.items || []
		: cartItems.value,
);
const total = computed(() => money(totalCents(items.value)));
async function openPayment() {
	if (paying.value) return;
	paying.value = true;
	try {
		const order = await createUnpaidOrder();
		go("04", { id: order.id });
	} catch (error) {
		toast(error.message);
	} finally {
		paying.value = false;
	}
}
async function pay() {
	if (paying.value || !items.value.length) return;
	const selectedOrder = paymentOrder.value;
	if (selectedOrder?.paid) {
		go("07", { id: selectedOrder.id });
		return;
	}
	paying.value = true;
	if (!DESIGN_MODE && connection.wechatPayment) {
		try {
			const order = selectedOrder || await createUnpaidOrder();
			await payWechat(order.id);
			go("05", { id: order.id });
		} catch (error) { toast(error.message); }
		finally { paying.value = false; }
		return;
	}
	if (!DESIGN_MODE && !connection.demoPayment) {
		paying.value = false;
		toast("尚未配置微信支付，请联系 KTV");
		return;
	}
	uni.showModal({
		title: "演示支付",
		content:
			"不会发起微信扣款。模拟支付成功后，订单将同步到食堂和管理端。是否继续？",
		confirmText: "模拟成功",
		confirmColor: "#329375",
		async success(result) {
			if (!result.confirm) {
				paying.value = false;
				return;
			}
			try {
				const order = selectedOrder || (await createUnpaidOrder());
				state.activeOrderId = order.id;
				await completeDemoPayment(order.id);
				go("05", { id: order.id });
			} catch (error) {
				toast(error.message);
			} finally {
				paying.value = false;
			}
		},
		fail() {
			paying.value = false;
		},
	});
}
</script>
