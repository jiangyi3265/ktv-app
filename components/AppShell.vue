<template>
	<view class="app-stage">
		<!-- #ifdef H5 -->
		<view class="review-sidebar">
			<view class="review-brand"
				><AppIcon
					name="tools-kitchen-2"
					color="orange"
					:size="25"
				/><text>包厢点餐</text></view
			>
			<text class="review-caption">{{
				DESIGN_MODE ? "设计还原 · 22 个页面" : "顾客 · 食堂 · KTV 管理"
			}}</text>
			<scroll-view scroll-y class="review-links">
				<view v-for="(item, index) in visiblePages" :key="item.id">
					<text
						v-if="
							index === 0 ||
							item.group !== visiblePages[index - 1].group
						"
						class="review-group"
						>{{ item.group }}</text
					>
					<button
						class="review-link"
						:class="{ selected: page === item.id }"
						@click="go(item.id)"
					>
						<text>{{ item.id }}</text
						>{{ item.title }}
					</button>
				</view>
			</scroll-view>
			<text class="review-note"
				>{{ DESIGN_MODE ? "本地交互演示" : "共享门店数据 · 自动同步"
				}}{{
					connection.demoPayment || DESIGN_MODE ? " · 模拟支付" : ""
				}}</text
			>
		</view>
		<!-- #endif -->
		<view
			class="phone-screen"
			:class="['screen-' + page, 'board-' + board]"
			:style="windowStyle"
		>
			<!-- #ifdef H5 -->
			<view class="status-bar"
				><text>{{ DESIGN_MODE ? "21:08" : clockText }}</text
				><view class="status-icons"
					><AppIcon name="antenna-bars-5" :size="17" /><AppIcon
						name="wifi"
						:size="16" /><AppIcon
						name="battery-4"
						:size="21" /></view
			></view>
			<!-- #endif -->
			<!-- #ifndef H5 -->
			<view :style="{ height: statusHeight + 'px', flexShrink: 0 }" />
			<!-- #endif -->
			<view
				class="topbar"
				:class="{
					'topbar-left': align === 'left' && !home,
					'has-subtitle': subtitle,
				}"
			>
				<button
					v-if="backTo && !home && !orderingClosed"
					class="icon-button back-button"
					aria-label="返回"
					@click="back(backTo)"
				>
					<AppIcon name="chevron-left" :size="25" />
				</button>
				<button v-if="home && !orderingClosed" class="home-button" :aria-label="homeToOrdering ? '返回点餐' : '返回首页'" @click="returnHome"><AppIcon name="chevron-left" :size="20" /><text>{{ homeToOrdering ? '点餐' : '首页' }}</text></button>
				<view class="topbar-title"
					><text>{{ orderingClosed ? '门店服务' : title }}</text
					><text v-if="subtitle" class="topbar-subtitle">{{
						subtitle
					}}</text></view
				>
				<view
					v-if="!orderingClosed && (DESIGN_MODE || connection.ready)"
					class="topbar-action"
					><slot name="header-action"
				/></view>
				<button
					v-if="
						!DESIGN_MODE && connection.ready && role !== 'customer'
					"
					class="session-exit"
					@click="signOut"
				>
					退出账号
				</button>
			</view>
			<ConnectionGate
				v-if="!DESIGN_MODE && !connection.ready && !publicPage"
				:role="role"
			/>
			<view
				v-if="!DESIGN_MODE && connection.ready && connection.offline"
				class="sync-warning"
				><text>连接中断，数据可能不是最新</text
				><button @click="retry">重试</button></view
			>
			<scroll-view
				v-if="!orderingClosed && (DESIGN_MODE || connection.ready || publicPage)"
				scroll-y
				:show-scrollbar="false"
				class="page-scroll"
				:class="contentClass"
				:key="scrollKey"
				><slot
			/></scroll-view>

			<view
				v-if="!orderingClosed && $slots.footer && (DESIGN_MODE || connection.ready)"
				class="page-footer"
				><slot name="footer"
			/></view>
			<view
				v-if="showTabs && (DESIGN_MODE || connection.ready)"
				class="bottom-nav"
			>
				<button
					v-for="tab in navItems"
					:key="tab.id"
					class="nav-item"
					:class="{ active: tab.id === activeTab }"
					@click="tab.action ? tab.action() : go(tab.id)"
				>
					<AppIcon
						:name="tab.icon"
						:filled="tab.id === activeTab"
						:color="tab.id === activeTab ? 'orange' : 'ink'"
						:size="25"
					/><text>{{ tab.label }}</text>
				</button>
			</view>
			<!-- #ifndef H5 -->
			<view
				v-if="
						!orderingClosed && !tabs && $slots.footer && (DESIGN_MODE || connection.ready)
				"
				:style="{ height: safeBottom + 'px', flexShrink: 0 }"
			/>
			<!-- #endif -->
			<slot v-if="!orderingClosed && (DESIGN_MODE || connection.ready)" name="overlay" />
		</view>
		<!-- #ifdef H5 -->
		<view class="review-current"
			><text>{{ page }} / {{ title }}</text
			><text>暖白 · 活力橙 · 玉石绿</text></view
		>
		<!-- #endif -->
	</view>
</template>
<script setup>
import { computed, watch, ref, nextTick, onMounted, onUnmounted } from "vue";
import { onShow, onHide } from "@dcloudio/uni-app";
import ConnectionGate from "./ConnectionGate.vue";
import {
	DESIGN_MODE,
	connection,
	activate,
	logout,
	refresh,
} from "../common/store";
import AppIcon from "./AppIcon.vue";
import { designPages, go, back, goHome } from "../common/pages";
const props = defineProps({
	page: String,
	title: String,
	subtitle: String,
	tabs: String,
	activeTab: String,
	backTo: String,
	contentClass: String,
	scrollKey: String,
	align: { type: String, default: "center" },
	accountRole: String,
	home: Boolean,
	publicPage: Boolean,
});
const windowStyle = ref({});
const statusHeight = ref(0);
const safeBottom = ref(0);
// Mini-program viewport units can include area outside the usable window.
// Use the native window height while retaining the H5 reference frame.
// #ifndef H5
function updateWindow() {
	const info = uni.getWindowInfo
		? uni.getWindowInfo()
		: uni.getSystemInfoSync();
	statusHeight.value = info.statusBarHeight || 0;
	safeBottom.value = info.safeArea
		? Math.max(0, info.screenHeight - info.safeArea.bottom)
		: 0;
	windowStyle.value = {
		height: info.windowHeight + "px",
		minHeight: "0",
		boxSizing: "border-box",
	};
}
updateWindow();
uni.onWindowResize(updateWindow);
onUnmounted(() => uni.offWindowResize(updateWindow));
// #endif
const clockText = ref(
	new Date().toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}),
);
const clockTimer = setInterval(() => {
	clockText.value = new Date().toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}, 30000);
onUnmounted(() => clearInterval(clockTimer));
const role = computed(
	() =>
		props.accountRole ||
		(Number(props.page) <= 8
			? "customer"
			: Number(props.page) <= 12
				? "supplier"
				: "admin"),
);
const orderingClosed = computed(() => !DESIGN_MODE && role.value === "customer" &&
	["01", "02", "03", "04"].includes(props.page) && !connection.orderingEnabled);
const homeToOrdering = computed(() => role.value === "customer" && connection.ready && connection.orderingEnabled);
function returnHome() {
	if (homeToOrdering.value) uni.reLaunch({ url: "/pages/index/index" });
	else goHome();
}
watch(
	role,
	(value) => {
		if (!DESIGN_MODE) activate(value);
	},
	{ immediate: true },
);
const pageVisible = ref(false);
let redirecting = false;
function redirectClosedOrdering() {
	if (!pageVisible.value || !orderingClosed.value || !connection.ready ||
		connection.role !== "customer" || redirecting) return;
	// Kept-alive pages must never redirect a different foreground page.
	const current = getCurrentPages().slice(-1)[0];
	if (current?.route !== designPages.find(item => item.id === props.page)?.path) return;
	redirecting = true;
	uni.redirectTo({ url: "/pages/service/index", complete: () => { redirecting = false; } });
}
watch(() => [orderingClosed.value, connection.ready, connection.role], redirectClosedOrdering, { flush: "post" });
onShow(() => {
	pageVisible.value = true;
	if (!DESIGN_MODE) {
		activate(role.value);
		nextTick(redirectClosedOrdering);
	}
});
// H5 registers the parent page after child mount; wait for that registration.
onMounted(() => { pageVisible.value = true; nextTick(redirectClosedOrdering); });
onHide(() => { pageVisible.value = false; });
const showTabs = computed(() => props.tabs && (props.tabs !== "customer" || DESIGN_MODE || connection.orderingEnabled));
const visiblePages = computed(() => DESIGN_MODE || connection.orderingEnabled
	? designPages : designPages.filter(item => Number(item.id) > 4));
async function signOut() {
	try {
		await logout();
	} catch (error) {
		uni.showToast({ title: error.message, icon: "none" });
	}
}
async function retry() {
	try {
		await refresh();
	} catch {}
}
const board = computed(() =>
	Number(props.page) <= 4
		? 1
		: Number(props.page) <= 8
			? 2
			: Number(props.page) <= 12
				? 3
				: Number(props.page) <= 17
					? 4
					: 5,
);
const navItems = computed(() =>
	props.tabs === "customer"
		? [
				{ id: "01", label: "点餐", icon: "tools-kitchen-2" },
				{ id: "06", label: "我的订单", icon: "receipt" },
			]
		: props.tabs === "supplier"
			? [
					{ id: "09", label: "工作台", icon: "briefcase" },
					{
						id: "09-completed",
						label: "已完成",
						icon: "clipboard-check",
						action: () => go("09", { filter: "completed" }),
					},
				]
			: [
					{ id: "13", label: "工作台", icon: "home" },
					{ id: "18", label: "订单", icon: "receipt" },
					{ id: "20", label: "设置", icon: "settings" },
				],
);
</script>
<style>
.phone-screen .topbar .home-button { position: absolute; left: 12px; bottom: 4px; min-width: 56px; height: 44px; display: flex; align-items: center; font-size: 14px; gap: 2px; color: var(--ink); }
.phone-screen .topbar .session-exit {
	position: absolute;
	right: 10px;
	bottom: 0;
	margin: 0;
	padding: 0 4px;
	height: 18px;
	line-height: 18px;
	font-size: 11px;
	color: #7d878e;
	background: transparent;
	z-index: 1;
}
.phone-screen .sync-warning {
	background: #fff0e6;
	color: #a44a22;
	padding: 8px 14px;
	font-size: 13px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-shrink: 0;
}
.phone-screen .sync-warning button {
	font-size: 13px;
	color: #a44a22;
	background: transparent;
	padding: 0 5px;
}
</style>
