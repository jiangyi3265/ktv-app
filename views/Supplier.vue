<template>
	<AppShell
		:page="page"
		:title="
			page === '09'
				? '接单工作台'
				: page === '10'
					? '订单详情'
					: page === '11'
						? '制作中'
						: delivered
							? '已送达'
							: '配送中'
		"
		:subtitle="
			page === '09'
				? state.accounts.find((a) => a.id === state.supplierId)?.name ||
					'合作食堂 A'
				: undefined
		"
		:tabs="page === '09' ? 'supplier' : undefined"
		:active-tab="filter === 'completed' ? '09-completed' : '09'"
		:back-to="page !== '09' ? '09' : undefined"
	>
		<view v-if="page === '09'" class="page-body supplier-body">
			<button
				v-if="
					showNotice &&
					filter !== 'completed' &&
					(DESIGN_MODE || newestPending)
				"
				class="new-order-banner"
				@click="DESIGN_MODE ? go('10') : openOrder(newestPending)"
			>
				<AppIcon name="bell" color="orange" :size="28" /><text
					class="fill"
					>新订单 ·
					{{ DESIGN_MODE ? "A08" : newestPending.room }} 包厢</text
				><text class="small">点击查看</text
				><AppIcon name="chevron-right" color="orange" :size="16" />
			</button>
			<view class="sound-setting"
				><AppIcon name="volume" color="gray" :size="29" /><view
					class="fill stack"
					><text>声音提醒</text
					><text class="muted small">小程序打开时提醒</text></view
				><button
					class="switch-control"
					:class="{ on: state.sound }"
					aria-label="声音提醒"
					role="switch"
					:aria-checked="state.sound"
					@click="toggleSound"
			/></view>
			<view class="supplier-tabs"
				><button
					v-for="tab in supplierTabs"
					:key="tab.key"
					:class="{ active: filter === tab.key }"
					@click="filter = tab.key"
				>
					{{ tab.label }}
					{{
						tab.key === "pending"
							? pendingCount
							: visibleSupplierOrders.filter(
									(order) => order.status === tab.key,
								).length
					}}
				</button></view
			>
			<view
				v-for="order in queue"
				:key="order.id"
				class="card supplier-order"
				><view class="between"
					><view class="row"
						><text class="supplier-room">{{ order.room }}</text
						><text class="bold">包厢</text></view
					><view class="row"
						><text class="muted small">{{
							DESIGN_MODE
								? order.id === "reference"
									? "刚刚"
									: "6 分钟前"
								: order.time
						}}</text
						><text
							class="badge"
							:class="{ gray: order.id !== 'reference' }"
							>{{ STATUS[order.status] }}</text
						></view
					></view
				><view class="supplier-dishes"
					><view
						v-for="item in order.items"
						:key="item.id"
						class="supplier-dish"
						><FoodImage
							:name="item.image"
							:src="item.customImage"
						/><text class="fill">{{ item.name }}</text
						><text class="dish-count"
							><text class="quantity-symbol">×</text
							>{{ item.quantity }}</text
						></view
					></view
				><view class="between"
					><text class="bold"
						>共
						{{
							order.items.reduce(
								(sum, item) => sum + item.quantity,
								0,
							)
						}}
						份</text
					><button
						:class="
							order.id === 'reference'
								? 'primary-button'
								: 'outline-button'
						"
						class="button-sm"
						@click="openOrder(order)"
					>
						{{
							order.status === "pending"
								? "查看并接单"
								: "查看订单"
						}}
					</button></view
				></view
			>
			<OrderPages />
			<view v-if="!queue.length" class="empty-state"
				><AppIcon
					name="clipboard-check"
					color="gray"
					:size="44"
				/><text>{{
					filter === "completed"
						? "还没有已完成订单"
						: "当前没有待处理订单"
				}}</text></view
			>
		</view>
		<view v-else-if="!DESIGN_MODE && !order.id" class="empty-state"
			><text>订单不存在或未分配给当前账号</text
			><button class="primary-button" @click="go('09')">
				返回工作台
			</button></view
		>
		<view v-else class="page-body supplier-detail">
			<view class="card supplier-room-card"
				><view class="between"
					><view
						><text class="large-room">{{ order.room }}</text
						><text class="room-unit">包厢</text></view
					><text v-if="page !== '12'" class="badge solid">{{
						page === "10" ? "待接单" : "制作中"
					}}</text
					><AppIcon
						v-else-if="delivered"
						name="circle-check"
						color="green"
						filled
						:size="80" /><FoodImage
						v-else
						name="delivery"
						class="supplier-bag" /></view
				><text class="supplier-subtitle">{{
					page === "10"
						? "已付款订单 · 等待处理"
						: page === "11"
							? DESIGN_MODE
								? "20:43 已接单"
								: (order.events?.find(
										(e) => e.label === "食堂接单",
									)?.time || "") + " 已接单"
							: delivered
								? "餐食已送达 · 订单已完成"
								: "已出餐 · 正在配送"
				}}</text
				><view v-if="page === '10'" class="supplier-metadata"
					><view
						><text class="muted">下单时间</text
						><text>{{
							DESIGN_MODE
								? "20:42"
								: order.time?.replace(/^今天\s*/, "")
						}}</text></view
					><view
						><text class="muted">订单尾号</text
						><text>{{
							order.id === "reference" ? "0086" : order.id
						}}</text></view
					></view
				><ProgressSteps
					v-if="page === '11'"
					:current="1"
					:labels="['待接单', '制作中', '配送中', '已完成']"
					numbered
			/></view>
			<view class="card"
				><view class="card-heading"
					><text>{{
						page === "10"
							? "餐品清单"
							: page === "11"
								? "本单餐品"
								: "餐品清单"
					}}</text
					><text class="muted">共 {{ count }} 份</text></view
				><ItemList
					:items="order.items"
					:prices="false"
					:checkable="page === '11'"
					:checked-ids="checkedIds"
					@check="toggleCheck"
			/></view>
			<view v-if="page === '10'" class="card row supplier-location"
				><AppIcon name="map-pin" filled color="gray" :size="38" /><view
					class="stack"
					><text class="muted">配送位置</text
					><text class="order-room">{{ order.room }} 包厢</text></view
				></view
			>
			<view v-if="page === '11'" class="packing-note"
				><AppIcon name="paper-bag" color="orange" :size="67" /><view
					><text class="bold">出餐前核对数量</text
					><text class="muted"
						>请将 {{ count }} 份餐食送至 {{ order.room }} 包厢</text
					></view
				></view
			>
			<view
				v-if="page === '12' && delivered"
				class="card delivered-feedback"
				><AppIcon name="circle-check" color="green" :size="45" /><text
					class="text-green bold"
					>已确认送达</text
				><text class="muted">订单已完成，顾客端状态同步更新</text></view
			>
		</view>
		<template v-if="page !== '09'" #footer
			><button
				class="primary-button"
				:disabled="
					!order.id ||
					connection.pending ||
					(page === '11' && !allItemsChecked)
				"
				@click="
					page === '12'
						? delivered
							? go('09', { filter: 'completed' })
							: (confirmOpen = true)
						: advance()
				"
			>
				{{
					page === "10"
						? "确认接单"
						: page === "11"
							? "出餐并开始配送"
							: delivered
								? "返回工作台"
								: "确认送达"
				}}
			</button></template
		>
		<template #overlay
			><view v-if="confirmOpen" class="overlay dialog-overlay"
				><view class="dialog"
					><AppIcon
						name="map-pin-check"
						color="green"
						:size="81"
					/><text class="dialog-title">确认已送达？</text
					><text class="dialog-copy"
						>{{ order.room }} 包厢 · 共 {{ count }} 份餐食</text
					><text class="dialog-copy">确认后订单将完成</text
					><view class="dialog-buttons"
						><button
							class="secondary-button"
							@click="confirmOpen = false"
						>
							暂不确认</button
						><button class="primary-button" @click="advance">
							确认送达
						</button></view
					></view
				></view
			></template
		>
	</AppShell>
</template>
<script setup>
import { computed, ref, watch, provide } from "vue";
provide("artboard", 3);
import { onShow, onHide } from "@dcloudio/uni-app";
import AppShell from "../components/AppShell.vue";
import OrderPages from "../components/OrderPages.vue";
import AppIcon from "../components/AppIcon.vue";
import FoodImage from "../components/FoodImage.vue";
import ItemList from "../components/ItemList.vue";
import ProgressSteps from "../components/ProgressSteps.vue";
import {
	state,
	sampleItems,
	visibleSupplierOrders,
	updateOrder,
	persist,
	DESIGN_MODE,
	connection,
} from "../common/store";
import { STATUS, supplierOrder } from "../common/domain.mjs";
import { go, toast } from "../common/pages";
import { useOrderFilter } from "../common/useOrderFilter";
const props = defineProps({ page: String, query: Object });
provide(
	"referencePage",
	computed(() => props.page),
);
const filter = ref("pending"),
	showNotice = ref(DESIGN_MODE),
	delivered = ref(false),
	confirmOpen = ref(DESIGN_MODE && props.page === "12");
const checkedIds = ref(["chicken", "bites"]);
useOrderFilter("supplier", () =>
	props.page === "09" ? { filter: filter.value } : {},
);
const supplierTabs = [
	{ key: "pending", label: "待接单" },
	{ key: "preparing", label: "制作中" },
	{ key: "delivering", label: "配送中" },
];
watch(
	() => props.query,
	(value) => {
		if (value?.filter) filter.value = value.filter;
		if (value?.id) confirmOpen.value = false;
	},
	{ immediate: true },
);
const fixture = computed(() => ({
	id: "reference",
	room: "A08",
	status:
		props.page === "11"
			? "preparing"
			: props.page === "12"
				? "delivering"
				: "pending",
	items: sampleItems.map(({ id, name, quantity, image }) => ({
		id,
		name,
		quantity,
		image,
	})),
}));
const order = computed(
	() =>
		visibleSupplierOrders.value.find(
			(item) => item.id === props.query?.id,
		) ||
		(state.orderDetail?.id === props.query?.id
			? state.orderDetail
			: null) ||
		(DESIGN_MODE
			? fixture.value
			: { id: "", items: [], status: "", room: "", events: [] }),
);
watch(
	() => order.value.id,
	() => {
		checkedIds.value = DESIGN_MODE
			? order.value.items.map((item) => item.id)
			: [];
	},
	{ immediate: true },
);
const allItemsChecked = computed(
	() =>
		order.value.items.length > 0 &&
		order.value.items.every((item) => checkedIds.value.includes(item.id)),
);
watch(
	() => order.value.status,
	(status) => {
		if (
			!DESIGN_MODE &&
			!connection.pending &&
			order.value.id &&
			props.page !== "09"
		) {
			const target = {
				pending: "10",
				preparing: "11",
				delivering: "12",
				completed: "12",
			}[status];
			if (target && target !== props.page) {
				go(target, { id: order.value.id });
				return;
			}
		}
		if (props.page === "12") {
			delivered.value = status === "completed";
			if (delivered.value) confirmOpen.value = false;
		}
	},
	{ immediate: true },
);
const count = computed(() =>
	order.value.items.reduce((sum, item) => sum + item.quantity, 0),
);
const queue = computed(() => [
	...(DESIGN_MODE && filter.value === "pending" && showNotice.value
		? [fixture.value]
		: []),
	...visibleSupplierOrders.value.filter(
		(item) => item.status === filter.value,
	),
]);
const pendingCount = computed(() =>
	!DESIGN_MODE
		? state.orderCounts.pending || 0
		: visibleSupplierOrders.value.filter(
				(item) => item.status === "pending",
			).length + (DESIGN_MODE && showNotice.value ? 1 : 0),
);
const newestPending = computed(() =>
	DESIGN_MODE
		? visibleSupplierOrders.value.find((item) => item.status === "pending")
		: state.orderAlerts[0],
);
function openOrder(item) {
	go(
		item.status === "pending"
			? "10"
			: item.status === "preparing"
				? "11"
				: "12",
		item.id === "reference" ? {} : { id: item.id },
	);
}
function toggleCheck(id) {
	checkedIds.value = checkedIds.value.includes(id)
		? checkedIds.value.filter((item) => item !== id)
		: [...checkedIds.value, id];
}
async function advance() {
	try {
		if (props.page === "11" && !allItemsChecked.value) {
			toast("请先核对全部餐品数量");
			return;
		}
		const account = state.accounts.find(
			(item) => item.id === (DESIGN_MODE ? "A01" : state.supplierId),
		);
		if (
			!account?.enabled ||
			(props.page === "12" ? !account.deliver : !account.process)
		) {
			toast("当前账号暂无此操作权限，请联系 KTV 管理员");
			return;
		}
		let id = order.value.id;
		if (DESIGN_MODE && id === "reference") {
			id = String(
				Math.max(...state.orders.map((item) => Number(item.id))) + 1,
			).padStart(4, "0");
			state.orders.unshift({
				id,
				room: "A08",
				customerId: "other-customer",
				status: fixture.value.status,
				paid: true,
				time: "今天 21:08",
				supplierId: "A01",
				items: JSON.parse(JSON.stringify(sampleItems)),
			});
		}
		await updateOrder(
			id,
			props.page === "10"
				? "preparing"
				: props.page === "11"
					? "delivering"
					: "completed",
			checkedIds.value,
		);
		if (props.page === "12") {
			confirmOpen.value = false;
			delivered.value = true;
			toast("已确认送达，订单已完成");
		} else go(props.page === "10" ? "11" : "12", { id });
	} catch (error) {
		toast(error.message);
	}
}
let visible = false;
onShow(() => {
	visible = true;
});
onHide(() => {
	visible = false;
});
function toggleSound() {
	state.sound = !state.sound;
	persist();
	if (state.sound) playNotice();
}
function playNotice() {
	if (!visible || !state.foreground || !state.sound) return;
	const audio = uni.createInnerAudioContext();
	audio.src = "/static/new-order.wav";
	audio.onEnded(() => audio.destroy());
	audio.onError(() => audio.destroy());
	audio.play();
}
watch(
	() =>
		(DESIGN_MODE
			? visibleSupplierOrders.value.filter(
					(item) => item.status === "pending",
				)
			: state.orderAlerts
		).map((item) => item.id),
	(ids, previous = []) => {
		if (ids.some((id) => !previous.includes(id))) {
			showNotice.value = true;
			playNotice();
		}
	},
);
</script>
