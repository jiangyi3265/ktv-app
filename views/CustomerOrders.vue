<template>
	<AppShell
		:page="page"
		:title="
			page === '05' ? '支付结果' : page === '06' ? '我的订单' : '订单详情'
		"
		:tabs="['05', '06'].includes(page) ? 'customer' : undefined"
		active-tab="06"
		:back-to="['07', '08'].includes(page) ? '06' : undefined"
	>
		<view
			v-if="!DESIGN_MODE && page !== '06' && !currentOrder.id"
			class="empty-state"
			><text>暂无这笔订单</text
			><button class="primary-button" @click="go('01')">
				去点餐
			</button></view
		>
		<view
			v-else-if="page === '05' && !DESIGN_MODE && !currentOrder.paid"
			class="empty-state"
		>
			<text>尚未确认支付成功</text
			><text>请查看订单状态，避免重复付款</text>
			<button class="primary-button" @click="openOrder(currentOrder)">
				查看订单
			</button>
		</view>
		<view v-else-if="page === '05'" class="page-body success-body">
			<view class="success-symbol"
				><view
					><AppIcon
						name="check"
						color="white"
						:size="57" /></view></view
			><text class="success-title">{{
				status === "refunded"
					? "已退款"
					: status === "refunding"
						? "退款处理中"
						: "支付成功"
			}}</text
			><text class="success-amount"
				><text class="success-currency">¥</text
				>{{ Number(orderTotal(currentOrder)).toFixed(2) }}</text
			><text class="success-subtitle">{{
				DESIGN_MODE
					? "订单已提交，等待食堂接单"
					: (currentOrder.paymentMode === "demo"
							? "演示订单 · "
							: "") + STATUS[status]
			}}</text>
			<view class="card success-receipt"
				><view class="card-heading"
					><text>{{ currentOrder.room }} 包厢</text
					><text class="muted"
						>共 {{ orderCount(currentOrder) }} 份餐食</text
					></view
				><ItemList :items="currentOrder.items" compact /><view
					class="section-divider"
				/><view class="info-row"
					><text>收款方</text><text>KTV 商户</text></view
				><view class="info-row"
					><text>订单号</text
					><text
						>{{ DESIGN_MODE ? "20261015" : ""
						}}{{ currentOrder.id }}</text
					></view
				></view
			>
			<button
				class="primary-button"
				@click="go('07', { id: currentOrder.id })"
			>
				查看订单</button
			><button class="outline-button" @click="go('01')">继续点餐</button>
		</view>
		<view v-else-if="page === '06'" class="page-body orders-body">
			<OrderPages />
			<view class="filters"
				><button
					v-for="tab in customerFilters"
					:key="tab.key"
					class="filter"
					:class="{ active: filter === tab.key }"
					@click="filter = tab.key"
				>
					{{ tab.label }}
				</button></view
			>
			<view
				v-for="order in orders"
				:key="order.id"
				class="card customer-order"
			>
				<view class="between"
					><view class="row"
						><text class="order-room">{{ order.room }} 包厢</text
						><text class="muted small">{{ order.time }}</text></view
					><text
						class="badge"
						:class="{
							green: order.status === 'completed',
							solid: ['delivering', 'completed'].includes(
								order.status,
							),
						}"
						>{{ STATUS[order.status] }}</text
					></view
				>
				<view v-if="order.items.length > 1" class="order-food-strip"
					><view
						v-for="item in order.items"
						:key="item.id"
						class="order-strip-item"
						><FoodImage
							:name="item.image"
							:src="item.customImage"
							class="food-small"
						/><text>{{ item.name }}</text
						><text>×{{ item.quantity }}</text></view
					></view
				>
				<view v-else class="single-order-item"
					><FoodImage
						:name="order.items[0].image"
						:src="order.items[0].customImage"
						class="food-small"
					/><view class="stack"
						><text>{{ order.items[0].name }}</text
						><text>×{{ order.items[0].quantity }}</text></view
					><text class="price single-order-price"
						><text class="price-currency">¥</text
						>{{ orderTotal(order) }}</text
					></view
				>
				<view v-if="order.items.length > 1" class="between"
					><text class="small">共 {{ orderCount(order) }} 份餐食</text
					><text class="price"
						><text class="price-currency">¥</text
						>{{ orderTotal(order) }}</text
					></view
				>
				<view class="order-actions"
					><button
						v-if="!DESIGN_MODE && order.status === 'unpaid'"
						class="text-button"
						@click="cancel(order)"
					>
						取消订单</button
					><button
						:class="
							order.status === 'unpaid'
								? 'primary-button'
								: 'outline-button'
						"
						class="button-sm"
						@click="openOrder(order)"
					>
						{{
							order.status === "unpaid"
								? "继续支付"
								: order.status === "completed"
									? "查看详情"
									: "查看进度"
						}}
					</button></view
				>
			</view>
			<view v-if="!orders.length" class="empty-state"
				><AppIcon name="receipt" color="gray" :size="42" /><text
					>这里还没有{{
						filter === "all"
							? ""
							: customerFilters.find(
									(item) => item.key === filter,
								)?.label
					}}订单</text
				><button class="primary-button" @click="go('01')">
					去点餐
				</button></view
			>
		</view>
		<view v-else class="page-body progress-body">
			<view class="order-status-panel" :class="{ completed: completed }"
				><view class="status-heading"
					><AppIcon
						:name="
							completed
								? 'circle-check'
								: status === 'unpaid'
									? 'receipt'
									: status === 'delivering'
										? 'delivery-bag'
										: 'chef-hat'
						"
						:color="completed ? 'green' : 'orange'"
						:filled="completed"
						:size="
							completed ? 88 : status === 'delivering' ? 118 : 66
						"
					/><view
						><text class="order-status-title">{{
							completed ? "已送达" : STATUS[status]
						}}</text
						><text class="order-status-subtitle">{{
							completed
								? `餐食已送至 ${currentOrder.room} 包厢`
								: status === "unpaid"
									? "订单尚未支付，支付后食堂开始处理"
									: status === "pending"
										? "食堂收到订单后将尽快制作"
										: status === "preparing"
											? "食堂正在为你制作餐食"
											: status === "cancelled"
												? "订单已取消，不会安排制作"
												: status === "refunding"
													? "退款处理中，请耐心等待"
													: status === "refunded"
														? "餐费已原路退回"
														: `餐食正在送往 ${currentOrder.room} 包厢`
						}}</text></view
					></view
				><text v-if="completed" class="delivered-time"
					>配送方已于
					{{
						DESIGN_MODE
							? "21:06"
							: currentOrder.events?.at(-1)?.time
					}}
					确认送达</text
				><ProgressSteps
					v-if="
						[
							'pending',
							'preparing',
							'delivering',
							'completed',
						].includes(status)
					"
					:current="
						completed
							? 3
							: status === 'delivering'
								? 2
								: status === 'preparing'
									? 1
									: 0
					"
					:green="completed"
			/></view>
			<view v-if="!completed" class="card between room-details"
				><view class="stack"
					><text class="muted">配送至</text
					><text class="order-room"
						>{{ currentOrder.room }} 包厢</text
					></view
				><AppIcon name="chevron-right" color="gray" :size="19"
			/></view>
			<view class="card meal-card"
				><text class="card-heading">{{
					completed ? "本次餐食" : "餐食清单"
				}}</text
				><ItemList :items="currentOrder.items" compact /><view
					class="price-line"
					><text>{{ currentOrder.paid ? "实付款" : "应付款" }}</text
					><text class="price"
						><text class="price-currency">¥</text
						>{{ orderTotal(currentOrder) }}</text
					></view
				></view
			>
			<view v-if="!completed" class="card"
				><text class="card-heading">订单进度</text
				><view
					v-for="event in events"
					:key="event.label"
					class="timeline-row"
					><text class="timeline-time">{{ event.time }}</text
					><text>{{ event.label }}</text></view
				></view
			>
			<view v-else class="card"
				><text class="card-heading">订单信息</text
				><view class="info-row"
					><text>订单号</text
					><text
						>{{ DESIGN_MODE ? "20261015" : ""
						}}{{ currentOrder.id }}</text
					></view
				><view class="info-row"
					><text>支付方式</text
					><text>{{
						currentOrder.paymentMode === "demo"
							? "演示支付（未扣款）"
							: "微信支付"
					}}</text></view
				><view class="info-row"
					><text>收款方</text><text>KTV 商户</text></view
				></view
			>
			<text v-if="!completed" class="delivery-note">{{
				status === "unpaid"
					? "支付成功后订单将交给食堂"
					: "送达后订单状态将自动更新"
			}}</text>
		</view>
		<template
			v-if="
				['07', '08'].includes(page) &&
				(DESIGN_MODE || currentOrder.id) &&
				(completed || status === 'unpaid')
			"
			#footer
			><button
				class="primary-button"
				@click="
					status === 'unpaid' ? openOrder(currentOrder) : go('01')
				"
			>
				{{ status === "unpaid" ? "继续支付" : "继续点餐" }}
			</button></template
		>
	</AppShell>
</template>
<script setup>
import { computed, ref, provide } from "vue";
provide("artboard", 2);
import AppShell from "../components/AppShell.vue";
import OrderPages from "../components/OrderPages.vue";
import AppIcon from "../components/AppIcon.vue";
import FoodImage from "../components/FoodImage.vue";
import ItemList from "../components/ItemList.vue";
import ProgressSteps from "../components/ProgressSteps.vue";
import {
	state,
	activeOrder,
	orderTotal,
	orderCount,
	persist,
	DESIGN_MODE,
	emptyOrder,
	cancelOrder,
} from "../common/store";
import { STATUS } from "../common/domain.mjs";
import { go, toast } from "../common/pages";
import { useOrderFilter } from "../common/useOrderFilter";
const props = defineProps({ page: String, query: Object });
provide(
	"referencePage",
	computed(() => props.page),
);
const filter = ref("all");
useOrderFilter("customer", () =>
	props.page === "06" ? { filter: filter.value } : {},
);
function cancel(order) {
	uni.showModal({
		title: "取消订单",
		content: "确认取消这笔未付款订单？",
		async success(result) {
			if (!result.confirm) return;
			try {
				await cancelOrder(order.id);
				toast("订单已取消");
			} catch (error) {
				toast(error.message);
			}
		},
	});
}
const customerFilters = [
	{ key: "all", label: "全部" },
	{ key: "unpaid", label: "待付款" },
	{ key: "active", label: "进行中" },
	{ key: "completed", label: "已完成" },
];
const currentOrder = computed(
	() =>
		state.orders.find((order) => order.id === props.query?.id) ||
		(state.orderDetail?.id === props.query?.id
			? state.orderDetail
			: null) ||
		(!DESIGN_MODE && props.query?.id ? emptyOrder : activeOrder.value),
);
const status = computed(() => currentOrder.value.status);
const completed = computed(
	() =>
		(DESIGN_MODE && props.page === "08" && !props.query?.id) ||
		status.value === "completed",
);
const orders = computed(() =>
	state.orders.filter(
		(order) =>
			order.customerId === state.customerId &&
			(filter.value === "all" ||
				(filter.value === "active" &&
					["pending", "preparing", "delivering"].includes(
						order.status,
					)) ||
				order.status === filter.value),
	),
);
const events = computed(() =>
	!DESIGN_MODE
		? [...(currentOrder.value.events || [])].reverse()
		: status.value === "unpaid"
			? [
					{
						time: currentOrder.value.time.replace(
							/^(今天|昨天)\s*/,
							"",
						),
						label: "订单待付款",
					},
				]
			: [
					...(status.value === "delivering"
						? [{ time: "21:00", label: "配送人员已取餐" }]
						: []),
					...(["delivering", "preparing"].includes(status.value)
						? [{ time: "20:45", label: "食堂开始制作" }]
						: []),
					{ time: "20:42", label: "支付成功" },
				],
);
function openOrder(order) {
	state.activeOrderId = order.id;
	persist();
	go(
		order.status === "unpaid"
			? "04"
			: order.status === "completed"
				? "08"
				: "07",
		{ id: order.id },
	);
}
</script>
