<template>
	<AppShell
		:page="page"
		:title="titles[page]"
		:align="page === '18' ? 'left' : 'center'"
		:back-to="
			['19', '21', '22'].includes(page)
				? page === '19'
					? '18'
					: '20'
				: undefined
		"
		:tabs="['18', '20'].includes(page) ? 'admin' : undefined"
		:active-tab="page === '18' ? '18' : '20'"
	>
		<template #header-action
			><button
				v-if="page === '20'"
				class="text-button"
				@click="openAccountEditor()"
			>
				新增
			</button></template
		>
		<view v-if="page === '18'" class="page-body admin-orders">
			<view class="search-field"
				><AppIcon name="search" color="gray" :size="18" /><input
					v-model="search"
					placeholder="搜索包厢或订单号"
					aria-label="搜索包厢或订单号" /></view
			><view class="filters"
				><button
					v-for="tab in ['全部', '待付款', '处理中', '已完成']"
					:key="tab"
					class="filter"
					:class="{ active: filter === tab }"
					@click="filter = tab"
				>
					{{ tab }}
				</button></view
			>
			<view class="order-dropdowns"
				><picker
					:range="[
						'全部包厢',
						...state.rooms.map((room) => room.id + ' 包厢'),
					]"
					@change="roomFilter = Number($event.detail.value)"
					><view class="dropdown-chip"
						><text>{{
							roomFilter === 0
								? "全部包厢"
								: state.rooms[roomFilter - 1].id + " 包厢"
						}}</text
						><AppIcon
							name="chevron-down"
							:size="14" /></view></picker
				><picker
					:range="['支付状态', '已付款', '待付款']"
					@change="paymentFilter = Number($event.detail.value)"
					><view class="dropdown-chip"
						><text>{{
							["支付状态", "已付款", "待付款"][paymentFilter]
						}}</text
						><AppIcon
							name="chevron-down"
							:size="14" /></view></picker
			></view>
			<view
				v-for="order in orders"
				:key="order.id"
				class="card admin-order-card"
				><view class="between"
					><view class="row"
						><text class="bold">{{ order.room }} 包厢</text
						><text class="muted small">#{{ order.id }}</text></view
					><view class="row"
						><text v-if="order.paid" class="badge green"
							>已付款</text
						><text
							class="badge"
							:class="{
								gray: !order.paid,
								green: order.status === 'completed',
							}"
							>{{ STATUS[order.status] }}</text
						></view
					></view
				><view class="admin-order-food"
					><view class="admin-order-thumbnails"
						><FoodImage
							v-for="item in order.items.slice(0, 2)"
							:key="item.id"
							:name="item.image"
							:src="item.customImage" /></view
					><view class="fill"
						><text v-for="item in order.items" :key="item.id"
							>{{ item.name }} ×{{ item.quantity }}</text
						></view
					></view
				><view class="between"
					><text class="small">{{ orderCount(order) }} 份餐食</text
					><text class="admin-order-price"
						><text class="price-currency">¥</text
						>{{ orderTotal(order) }}</text
					><button class="view-order" @click="openOrder(order)">
						查看详情<AppIcon
							name="chevron-right"
							:size="14"
						/></button></view
			></view>
			<view v-if="!orders.length" class="empty-state"
				><AppIcon name="receipt" color="gray" :size="42" /><text
					>没有符合筛选条件的订单</text
				><button
					class="text-button"
					@click="
						search = '';
						filter = '全部';
						roomFilter = 0;
						paymentFilter = 0;
					"
				>
					清除筛选
				</button></view
			>
		</view>
		<view
			v-else-if="page === '19' && !DESIGN_MODE && !detailOrder.id"
			class="empty-state"
			><text>订单不存在</text
			><button class="primary-button" @click="go('18')">
				返回订单列表
			</button></view
		>
		<view v-else-if="page === '19'" class="page-body admin-detail">
			<view class="admin-completed-panel"
				><AppIcon
					:name="
						detailStatus === 'completed'
							? 'circle-check'
							: 'receipt'
					"
					:color="detailStatus === 'completed' ? 'green' : 'orange'"
					:filled="detailStatus === 'completed'"
					:size="38"
				/><view
					><text class="admin-completed-title">{{
						STATUS[detailStatus]
					}}</text
					><text
						>{{ detailOrder.room }} 包厢 · #{{
							detailOrder.id
						}}</text
					></view
				></view
			>
			<view class="card"
				><text class="card-heading">餐品明细</text
				><ItemList :items="detailOrder.items" compact /><view
					class="price-line"
					><text>实付</text
					><text class="price"
						><text class="price-currency">¥</text
						>{{
							detailOrder.paid ? orderTotal(detailOrder) : "0"
						}}</text
					></view
				></view
			>
			<view class="card payment-info"
				><text class="card-heading">支付信息</text
				><view class="info-row"
					><text>支付状态</text
					><text :class="{ 'text-green': detailOrder.paid }">{{
						detailOrder.paid ? "已付款" : "待付款"
					}}</text></view
				><view class="info-row"
					><text>收款方</text><text>KTV 商户</text></view
				><view class="info-row"
					><text>支付方式</text
					><view class="row"
						><AppIcon
							name="brand-wechat"
							color="green"
							:size="20"
						/><text>微信支付</text></view
					></view
				></view
			>
			<view class="card timeline-green"
				><text class="card-heading">订单进度</text
				><view
					v-for="event in detailEvents"
					:key="event.label"
					class="timeline-row"
					><text class="timeline-time">{{ event.time }}</text
					><text>{{ event.label }}</text></view
				></view
			>
			<button
				class="card exception-entry"
				@click="pendingRule('异常处理')"
			>
				<view class="fill"
					><view class="row"
						><text class="bold">异常处理</text
						><text class="badge">规则待确认</text></view
					><text class="muted small">取消与退款流程待确认</text></view
				><AppIcon name="chevron-right" :size="20" />
			</button>
		</view>
		<view v-else-if="page === '20'" class="page-body accounts-body">
			<view class="search-field"
				><AppIcon name="search" color="gray" :size="18" /><input
					v-model="search"
					placeholder="搜索账号"
					aria-label="搜索账号" /></view
			><view class="filters"
				><button
					v-for="tab in ['全部', '已启用', '已停用']"
					:key="tab"
					class="filter"
					:class="{ active: filter === tab }"
					@click="filter = tab"
				>
					{{ tab }}
				</button></view
			>
			<view
				v-for="account in accounts"
				:key="account.id"
				class="card account-card"
				><view class="row"
					><view
						class="account-avatar"
						:class="{ disabled: !account.enabled }"
						><AppIcon
							name="user"
							filled
							color="white"
							:size="31" /></view
					><view class="fill"
						><text class="account-name">{{ account.name }}</text
						><text class="muted small"
							>账号：食堂 {{ account.id }}</text
						></view
					><text
						class="badge"
						:class="account.enabled ? 'green' : 'gray'"
						>{{ account.enabled ? "已启用" : "已停用" }}</text
					></view
				><view class="account-card-bottom"
					><text class="muted small">数据范围</text
					><text>仅已分配订单</text
					><button
						class="text-button"
						@click="openPermissions(account)"
					>
						{{ account.enabled ? "查看权限" : "编辑" }} ›
					</button></view
				></view
			>
			<view v-if="!accounts.length" class="empty-state"
				><text>没有找到相关账号</text></view
			><view class="permission-empty"
				><AppIcon name="shield-check" color="gray" :size="62" /><text
					class="bold"
					>外包账号仅可查看分配订单</text
				><text class="muted small">不开放 KTV 其他经营数据</text></view
			>
		</view>
		<view v-else-if="page === '21'" class="page-body permission-body">
			<view class="card permission-account"
				><view class="account-avatar"
					><AppIcon
						name="user"
						filled
						color="white"
						:size="30" /></view
				><view class="fill"
					><text class="account-name">{{ account.name }}</text
					><text class="muted small"
						>账号：食堂 {{ account.id }}</text
					></view
				><button
					class="badge"
					:class="permissionForm.enabled ? 'green' : 'gray'"
					@click="permissionForm.enabled = !permissionForm.enabled"
				>
					{{ permissionForm.enabled ? "已启用" : "已停用" }}
				</button></view
			>
			<view class="card permission-card"
				><text class="card-heading">可见内容</text
				><view class="permission-row"
					><text>包厢与订单状态</text
					><view class="check-box checked"
						><AppIcon
							name="check"
							color="white"
							:size="17" /></view></view
				><view class="permission-row"
					><text>餐品与数量</text
					><view class="check-box checked"
						><AppIcon
							name="check"
							color="white"
							:size="17" /></view></view
				><view class="permission-row"
					><text>KTV 总体经营数据</text
					><view class="row"
						><AppIcon name="lock" color="gray" :size="18" /><text
							class="muted"
							>不可见</text
						></view
					></view
				></view
			>
			<view class="card permission-card permission-scope"
				><view class="permission-row"
					><text class="bold">订单范围</text
					><view class="row"
						><text>仅已分配订单</text
						><AppIcon
							name="chevron-right"
							color="gray"
							:size="18" /></view></view
				><button
					class="permission-row full-width"
					@click="pendingRule('订单分配方式')"
				>
					<text class="bold">订单分配方式</text
					><view class="row"
						><text class="badge">待确认</text
						><AppIcon name="chevron-right" color="gray" :size="18"
					/></view></button
			></view>
			<view class="card permission-card"
				><text class="card-heading">操作权限</text
				><view class="permission-row"
					><text>接单与更新进度</text
					><button
						class="switch-control"
						:class="{ on: permissionForm.process }"
						role="switch"
						:aria-checked="permissionForm.process"
						aria-label="接单与更新进度权限"
						@click="
							permissionForm.process = !permissionForm.process
						" /></view
				><view class="permission-row"
					><text>确认送达</text
					><button
						class="switch-control"
						:class="{ on: permissionForm.deliver }"
						role="switch"
						:aria-checked="permissionForm.deliver"
						aria-label="确认送达权限"
						@click="
							permissionForm.deliver = !permissionForm.deliver
						" /></view
			></view>
			<view v-if="!DESIGN_MODE" class="card permission-card"
				><text class="card-heading">登录密码</text
				><input
					v-model="permissionPassword"
					password
					class="dialog-input"
					placeholder="留空不修改，重设需 12–72 位"
					aria-label="重设食堂登录密码"
			/></view>
			<view class="permission-notes"
				><AppIcon name="info-circle" color="gray" :size="16" /><view
					><text>食堂与配送账号分工待确认</text
					><text>金额及联系方式是否开放待确认</text></view
				></view
			>
		</view>
		<view v-else class="page-body payment-settings">
			<view class="card"
				><view class="card-heading"
					><view class="row"
						><view class="wechat-icon"
							><AppIcon
								name="brand-wechat"
								color="white"
								:size="27" /></view
						><text>微信支付</text></view
					></view
				><view class="info-row"
					><text>收款主体</text><text>KTV 商户</text></view
				><view class="info-row"
					><text>商户号</text><text>**** 0086</text></view
				><view class="section-divider" /><button
					class="text-button config-button"
					@click="paymentConfigOpen = true"
				>
					编辑配置 ›
				</button></view
			>
			<view class="card payment-records"
				><text class="card-heading">支付记录</text
				><button
					v-for="record in paymentRecords"
					:key="record.id"
					class="payment-record"
					@click="openOrder(record)"
				>
					<view class="fill"
						><text>#{{ record.id }}</text
						><text class="muted small">{{
							DESIGN_MODE
								? "2026-10-15 " +
									(record.paid ? "20:42" : "21:03")
								: record.createdAt
										?.replace("T", " ")
										.slice(0, 16)
						}}</text></view
					><text v-if="record.paid" class="text-green small"
						>支付成功</text
					><text v-else class="badge gray">待付款</text
					><text class="bold"
						><text class="price-currency">¥</text
						>{{ orderTotal(record) }}</text
					><AppIcon
						name="chevron-right"
						color="gray"
						:size="16"
					/></button
			></view>
			<view class="card status-rules"
				><text class="card-heading">状态规则</text
				><view class="rule-row"
					><AppIcon name="tools-kitchen-2" :size="26" /><text
						>支付成功后交给食堂</text
					></view
				><view class="rule-row"
					><AppIcon name="truck-delivery" :size="26" /><text
						>配送方确认后完成</text
					></view
				><view class="rule-row"
					><AppIcon name="receipt" :size="26" /><text
						>KTV 与外包方线下结算</text
					></view
				><button class="record-link" @click="go('19')">
					<text>查看状态变更记录</text
					><AppIcon
						name="chevron-right"
						color="gray"
						:size="19"
					/></button
			></view>
		</view>
		<template v-if="page === '21'" #footer
			><button class="primary-button" @click="savePermissions">
				保存设置
			</button></template
		>
		<template #overlay>
			<view v-if="accountEditor" class="overlay dialog-overlay"
				><view class="dialog"
					><text class="dialog-title">新增外包账号</text
					><input
						v-model="newName"
						class="dialog-input"
						placeholder="合作方或账号名称"
						aria-label="账号名称"
					/><input
						v-if="!DESIGN_MODE"
						v-model="newPassword"
						password
						class="dialog-input"
						placeholder="初始登录密码（12–72 位）"
						aria-label="初始登录密码"
					/><text v-if="accountError" class="form-error">{{
						accountError
					}}</text
					><view class="dialog-buttons"
						><button
							class="secondary-button"
							@click="accountEditor = false"
						>
							取消</button
						><button class="primary-button" @click="saveAccount">
							保存账号
						</button></view
					></view
				></view
			>
			<view v-if="paymentConfigOpen" class="overlay dialog-overlay"
				><view class="dialog config-dialog"
					><AppIcon
						name="credit-card"
						color="orange"
						:size="43"
					/><text class="dialog-title">微信支付接入</text
					><text class="dialog-copy"
						>需要 KTV 提供小程序 AppID
						和微信支付商户号，并由服务端配置支付密钥、证书与回调地址。</text
					><text class="muted config-hint"
						>当前为示例配置，不会发起真实交易。</text
					><button
						class="primary-button"
						@click="paymentConfigOpen = false"
					>
						我知道了
					</button></view
				></view
			>
		</template>
	</AppShell>
</template>
<script setup>
import { computed, reactive, ref, watch, provide } from "vue";
provide("artboard", 5);
import AppShell from "../components/AppShell.vue";
import AppIcon from "../components/AppIcon.vue";
import FoodImage from "../components/FoodImage.vue";
import ItemList from "../components/ItemList.vue";
import {
	state,
	activeOrder,
	orderTotal,
	orderCount,
	persist,
	DESIGN_MODE,
	emptyOrder,
	connection,
	saveAccount as commitAccount,
} from "../common/store";
import { STATUS } from "../common/domain.mjs";
import { go, toast } from "../common/pages";
const props = defineProps({ page: String, query: Object });
provide(
	"referencePage",
	computed(() => props.page),
);
const titles = {
	18: "订单管理",
	19: "订单详情",
	20: "外包账号",
	21: "账号权限",
	22: "支付与状态",
};
const search = ref(""),
	filter = ref("全部"),
	roomFilter = ref(0),
	paymentFilter = ref(0),
	accountEditor = ref(false),
	newName = ref(""),
	newPassword = ref(""),
	permissionPassword = ref(""),
	accountError = ref(""),
	paymentConfigOpen = ref(false);
const orders = computed(() =>
	state.orders
		.filter(
			(order) =>
				(order.room + order.id)
					.toLowerCase()
					.includes(search.value.toLowerCase()) &&
				(filter.value === "全部" ||
					(filter.value === "待付款" && order.status === "unpaid") ||
					(filter.value === "处理中" &&
						["pending", "preparing", "delivering"].includes(
							order.status,
						)) ||
					(filter.value === "已完成" &&
						order.status === "completed")) &&
				(!roomFilter.value ||
					order.room === state.rooms[roomFilter.value - 1]?.id) &&
				(!paymentFilter.value ||
					order.paid === (paymentFilter.value === 1)),
		)
		.filter(
			(order) =>
				!DESIGN_MODE || filter.value !== "全部" || order.id !== "0081",
		),
);
const detailOrder = computed(
	() =>
		state.orders.find((order) => order.id === props.query?.id) ||
		(!DESIGN_MODE && props.query?.id ? emptyOrder : activeOrder.value),
);
const detailStatus = computed(() =>
	props.query?.id || !DESIGN_MODE ? detailOrder.value.status : "completed",
);
const detailEvents = computed(() => {
	if (!DESIGN_MODE) return detailOrder.value.events || [];
	const events = [
		{ time: "20:42", label: "支付成功" },
		{ time: "20:43", label: "食堂接单" },
		{ time: "21:00", label: "开始配送" },
		{ time: "21:06", label: "配送方确认送达" },
	];
	return detailStatus.value === "unpaid"
		? [{ time: "21:03", label: "订单已创建，等待支付" }]
		: events.slice(
				0,
				{ pending: 1, preparing: 2, delivering: 3, completed: 4 }[
					detailStatus.value
				] || 1,
			);
});
const accounts = computed(() =>
	state.accounts.filter(
		(account) =>
			(account.name + account.id).includes(search.value) &&
			(filter.value === "全部" ||
				account.enabled === (filter.value === "已启用")),
	),
);
const account = computed(
	() =>
		state.accounts.find((item) => item.id === state.selectedAccount) ||
		state.accounts[0] || {
			id: "",
			name: "",
			enabled: false,
			process: false,
			deliver: false,
		},
);
const permissionForm = reactive({
	...account.value,
	enabled: account.value.enabled,
	process: account.value.process,
	deliver: account.value.deliver,
});
watch(
	() => [state.selectedAccount, connection.ready],
	() => Object.assign(permissionForm, account.value),
);
const paymentRecords = computed(() =>
	(DESIGN_MODE
		? [
				state.orders.find((order) => order.id === "0086"),
				state.orders.find((order) => order.id === "0088"),
			]
		: state.orders
	).filter(Boolean),
);
function openOrder(order) {
	state.activeOrderId = order.id;
	persist();
	go("19", { id: order.id });
}
function openPermissions(item) {
	state.selectedAccount = item.id;
	persist();
	go("21");
}
async function savePermissions() {
	if (!DESIGN_MODE) {
		try {
			await commitAccount({
				...account.value,
				...permissionForm,
				...(permissionPassword.value
					? { password: permissionPassword.value }
					: {}),
			});
			permissionPassword.value = "";
			Object.assign(permissionForm, account.value);
			toast("账号权限已保存");
		} catch (error) {
			toast(error.message);
		}
		return;
	}
	Object.assign(account.value, permissionForm);
	persist();
	toast("账号权限已保存");
}
function pendingRule(title) {
	uni.showModal({
		title,
		content:
			title === "异常处理"
				? "取消阶段、退款审核及执行责任需确认后开通。"
				: "按包厢、餐品或其他方式分配的规则需确认后开通。当前仅展示已分配订单。",
		showCancel: false,
		confirmColor: "#f57636",
	});
}
function openAccountEditor() {
	newName.value = "";
	newPassword.value = "";
	accountError.value = "";
	accountEditor.value = true;
}
async function saveAccount() {
	if (!newName.value.trim()) {
		accountError.value = "请输入账号名称";
		return;
	}
	if (
		state.accounts.some((account) => account.name === newName.value.trim())
	) {
		accountError.value = "账号名称已存在";
		return;
	}
	if (!DESIGN_MODE) {
		try {
			const result = await commitAccount({
				name: newName.value.trim(),
				password: newPassword.value,
				enabled: true,
				process: true,
				deliver: true,
			});
			accountEditor.value = false;
			newPassword.value = "";
			uni.showModal({
				title: "账号已创建",
				content:
					"登录账号：" +
					result.id +
					"。请将账号和设置的密码交给食堂。",
				showCancel: false,
			});
		} catch (error) {
			accountError.value = error.message;
		}
		return;
	}
	state.accounts.push({
		id: "A" + String(state.accounts.length + 1).padStart(2, "0"),
		name: newName.value.trim(),
		enabled: true,
		process: true,
		deliver: true,
	});
	persist();
	accountEditor.value = false;
	toast("外包账号已创建");
}
</script>
