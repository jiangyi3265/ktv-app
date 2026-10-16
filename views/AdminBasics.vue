<template>
	<AppShell
		:page="page"
		:title="titles[page]"
		:align="page === '13' ? 'left' : 'center'"
		:back-to="page !== '13' ? '13' : undefined"
		:tabs="['13', '14', '16'].includes(page) ? 'admin' : undefined"
		active-tab="13"
	>
		<template #header-action
			><text v-if="page === '13'" class="badge">管理员</text
			><button
				v-if="['14', '16'].includes(page)"
				class="text-button"
				@click="page === '14' ? openRoomEditor() : editProduct()"
			>
				新增
			</button></template
		>
		<view v-if="page === '13'" class="page-body admin-home">
			<view class="admin-hero"
				><AppIcon name="cloche" color="orange" :size="49" /><view
					class="fill"
					><text>餐食服务管理</text
					><text>管理本店包厢、餐品与订单</text></view
				><AppIcon name="chevron-right" color="white"
			/></view>
			<text class="section-title">常用管理</text
			><view class="admin-menu"
				><button
					v-for="item in menu"
					:key="item.page"
					@click="go(item.page)"
				>
					<AppIcon
						:name="item.icon"
						color="orange"
						:size="37"
					/><text>{{ item.name }}</text>
				</button></view
			>
			<button class="card admin-payment-entry" @click="go('22')">
				<AppIcon name="credit-card" :size="25" /><text class="fill"
					>支付配置与记录</text
				><AppIcon name="chevron-right" :size="20" />
			</button>
			<view class="business-flow"
				><text class="bold">业务流程</text
				><view
					v-for="(text, index) in [
						'顾客支付给 KTV',
						'食堂制作并配送',
						'配送方确认完成',
					]"
					:key="text"
					><text class="flow-number">{{ index + 1 }}</text
					><text>{{ text }}</text></view
				></view
			>
		</view>
		<view v-else-if="page === '14'" class="page-body">
			<view class="search-field"
				><AppIcon name="search" color="gray" :size="18" /><input
					v-model="search"
					placeholder="搜索包厢名称或编号"
					aria-label="搜索包厢" /></view
			><view class="filters"
				><button
					v-for="tab in ['全部', '已绑定', '未绑定']"
					:key="tab"
					class="filter"
					:class="{ active: filter === tab }"
					@click="filter = tab"
				>
					{{ tab }}
				</button></view
			>
			<view v-for="room in rooms" :key="room.id" class="card room-card"
				><AppIcon name="door" :size="40" /><view class="fill"
					><view class="row"
						><text class="bold">{{ room.id }} 包厢</text
						><text class="badge" :class="{ green: room.bound }">{{
							room.bound ? "已绑定" : "未绑定"
						}}</text></view
					><text class="muted small">{{
						room.bound ? "专属二维码已生成" : "未生成二维码"
					}}</text></view
				><view class="room-actions"
					><button
						v-if="room.bound"
						class="qr-link"
						@click="openQR(room)"
					>
						<AppIcon name="qrcode" :size="25" /><text
							>查看</text
						></button
					><button
						v-else
						class="primary-button button-sm"
						@click="bindRoom(room)"
					>
						生成并绑定</button
					><button class="edit-link" @click="openRoomEditor(room)">
						<AppIcon name="pencil" :size="14" /><text>编辑</text>
					</button></view
				></view
			>
			<view v-if="!rooms.length" class="empty-state"
				><AppIcon name="door" color="gray" :size="40" /><text
					>没有找到相关包厢</text
				></view
			><view class="inline-note"
				><AppIcon name="info-circle" color="gray" :size="15" /><text
					>每个包厢使用独立二维码</text
				></view
			>
		</view>
		<view v-else-if="page === '15'" class="page-body qr-body">
			<view class="card qr-card"
				><text class="qr-room">{{ state.selectedRoom }} 包厢</text
				><text class="qr-subtitle">扫码即可点餐</text
				><FoodImage name="qr" class="room-qr" /><text class="qr-label"
					>包厢专属点餐码</text
				></view
			>
			<view class="card binding-card"
				><view class="between"
					><text>绑定包厢</text
					><text>{{ state.selectedRoom }} 包厢</text
					><button class="text-button" @click="chooseRoom">
						修改绑定 ›
					</button></view
				><view class="row"
					><text>状态</text
					><text class="text-green"
						><text class="status-dot" />已启用</text
					></view
				></view
			>
			<button class="primary-button" @click="saveQR">保存二维码</button
			><button class="text-button qr-regenerate" @click="regenerateQR">
				重新生成</button
			><text class="qr-demo-note">二维码为设计示意</text>
		</view>
		<view v-else-if="page === '16'" class="page-body">
			<view class="search-field"
				><AppIcon name="search" color="gray" :size="18" /><input
					v-model="search"
					placeholder="搜索餐品"
					aria-label="搜索餐品" /></view
			><view class="filters"
				><button
					v-for="tab in ['全部', '上架中', '已下架']"
					:key="tab"
					class="filter"
					:class="{ active: filter === tab }"
					@click="filter = tab"
				>
					{{ tab }}
				</button></view
			>
			<view
				v-for="product in products"
				:key="product.id"
				class="card product-card"
				><FoodImage
					:name="product.image"
					:src="product.customImage"
				/><view class="fill product-info"
					><text class="bold">{{ product.name }}</text
					><text class="category-tag">{{ product.category }}</text
					><text class="product-price"
						><text class="price-currency">¥</text>
						{{ product.price }}</text
					></view
				><view class="product-actions"
					><button
						class="switch-control"
						:class="{ on: product.onSale }"
						:aria-label="product.name + '上架状态'"
						role="switch"
						:aria-checked="product.onSale"
						@click="toggleProduct(product)"
					/><text class="muted small">{{
						product.onSale ? "上架中" : "已下架"
					}}</text
					><button class="edit-link" @click="editProduct(product)">
						<AppIcon name="pencil" :size="15" /><text>编辑</text>
					</button></view
				></view
			>
			<view v-if="!products.length" class="empty-state"
				><AppIcon name="tools-kitchen-2" color="gray" :size="40" /><text
					>暂无符合条件的餐品</text
				><button class="text-button" @click="editProduct()">
					新增餐品
				</button></view
			>
		</view>
		<view v-else class="page-body edit-product-body">
			<view class="card photo-field"
				><text class="form-label">餐品图片</text
				><view class="photo-preview"
					><FoodImage
						:name="form.image === 'chicken' ? 'large' : form.image"
						:src="form.customImage"
						class="edit-food-photo"
					/><button class="change-photo" @click="changePhoto">
						更换图片
					</button></view
				></view
			>
			<view class="card product-form"
				><view class="form-row"
					><text class="form-label">餐品名称</text
					><input
						v-model="form.name"
						maxlength="20"
						placeholder="请输入餐品名称"
						aria-label="餐品名称" /></view
				><view class="form-row"
					><text class="form-label">分类</text
					><picker
						:range="['主食', '小吃']"
						@change="
							form.category = ['主食', '小吃'][
								$event.detail.value
							]
						"
						><view class="row"
							><text>{{ form.category }}</text
							><AppIcon
								name="chevron-right"
								:size="20" /></view></picker></view
				><view class="form-row"
					><text class="form-label">售价</text
					><text class="price-input-prefix">¥</text
					><input
						v-model="form.price"
						type="digit"
						placeholder="0.00"
						aria-label="售价" /></view
				><view class="form-row"
					><text class="form-label fill">上架状态</text
					><button
						class="switch-control"
						:class="{ on: form.onSale }"
						role="switch"
						aria-label="上架状态"
						:aria-checked="form.onSale"
						@click="form.onSale = !form.onSale"
					/><text>{{ form.onSale ? "上架中" : "已下架" }}</text></view
				></view
			><text class="edit-note">保存后更新点餐页信息</text
			><text v-if="formError" class="form-error">{{ formError }}</text>
		</view>
		<template v-if="page === '17'" #footer
			><button class="primary-button" @click="saveProduct">
				保存餐品
			</button></template
		>
		<template #overlay
			><view v-if="roomEditor" class="overlay dialog-overlay"
				><view class="dialog room-editor"
					><text class="dialog-title">{{
						editingRoom ? "编辑包厢" : "新增包厢"
					}}</text
					><text class="muted">输入包厢编号，例如 A08</text
					><input
						v-model="roomName"
						class="dialog-input"
						maxlength="12"
						placeholder="包厢编号"
						aria-label="包厢编号"
					/><text v-if="roomError" class="form-error">{{
						roomError
					}}</text
					><view class="dialog-buttons"
						><button
							class="secondary-button"
							@click="roomEditor = false"
						>
							取消</button
						><button class="primary-button" @click="saveRoom">
							保存包厢
						</button></view
					></view
				></view
			></template
		>
	</AppShell>
</template>
<script setup>
import { computed, reactive, ref, watch } from "vue";
import AppShell from "../components/AppShell.vue";
import AppIcon from "../components/AppIcon.vue";
import FoodImage from "../components/FoodImage.vue";
import {
	state,
	persist,
	DESIGN_MODE,
	connection,
	saveProduct as commitProduct,
	saveRoom as commitRoom,
	saveImage,
} from "../common/store";
import { go, toast } from "../common/pages";
const props = defineProps({ page: String, query: Object });
const titles = {
	13: "KTV 管理",
	14: "包厢管理",
	15: "包厢二维码",
	16: "餐品管理",
	17: "编辑餐品",
};
const menu = [
	{ page: "14", name: "包厢管理", icon: "door" },
	{ page: "16", name: "餐品管理", icon: "tools-kitchen-2" },
	{ page: "18", name: "订单管理", icon: "receipt" },
	{ page: "20", name: "外包账号", icon: "users" },
];
const search = ref(""),
	filter = ref("全部"),
	formError = ref(""),
	roomError = ref(""),
	roomEditor = ref(false),
	editingRoom = ref(null),
	roomName = ref("");
const rooms = computed(() =>
	state.rooms.filter(
		(room) =>
			room.id.toLowerCase().includes(search.value.toLowerCase()) &&
			(filter.value === "全部" ||
				room.bound === (filter.value === "已绑定")),
	),
);
const products = computed(() =>
	state.products.filter(
		(product) =>
			product.name.includes(search.value) &&
			(filter.value === "全部" ||
				product.onSale === (filter.value === "上架中")),
	),
);
const form = reactive({
	name: "宫保鸡丁饭",
	category: "主食",
	price: "32.00",
	onSale: true,
	image: "chicken",
	customImage: "",
});
watch(
	() => [props.query, connection.ready, state.selectedProduct],
	([query]) => {
		if (props.page === "17") {
			const product = query?.new
				? null
				: state.products.find(
						(item) => item.id === state.selectedProduct,
					);
			Object.assign(
				form,
				product
					? { ...product, price: Number(product.price).toFixed(2) }
					: {
							name: "",
							category: "主食",
							price: "",
							onSale: true,
							image: "chicken",
							customImage: "",
						},
			);
		}
	},
	{ immediate: true },
);
function editProduct(product) {
	state.selectedProduct = product?.id || "";
	persist();
	go("17", product ? {} : { new: "1" });
}
async function toggleProduct(product) {
	if (!DESIGN_MODE) {
		try {
			await commitProduct({ ...product, onSale: !product.onSale });
			toast(product.onSale ? "餐品已下架" : "餐品已上架");
		} catch (error) {
			toast(error.message);
		}
		return;
	}
	product.onSale = !product.onSale;
	persist();
	toast(product.onSale ? "餐品已上架" : "餐品已下架");
}
function openQR(room) {
	state.selectedRoom = room.id;
	persist();
	go("15");
}
async function bindRoom(room) {
	if (!DESIGN_MODE) {
		try {
			await commitRoom({ ...room, bound: true });
			openQR(room);
		} catch (error) {
			toast(error.message);
		}
		return;
	}
	room.bound = true;
	persist();
	openQR(room);
}
function openRoomEditor(room) {
	editingRoom.value = room || null;
	roomName.value = room?.id || "";
	roomError.value = "";
	roomEditor.value = true;
}
async function saveRoom() {
	const name = roomName.value.trim().toUpperCase();
	if (!/^[A-Z0-9\u4e00-\u9fa5-]{1,12}$/.test(name)) {
		roomError.value = "请输入 1–12 位有效包厢编号";
		return;
	}
	if (
		state.rooms.some(
			(room) => room.id === name && room.id !== editingRoom.value?.id,
		)
	) {
		roomError.value = "这个包厢编号已存在";
		return;
	}
	if (!DESIGN_MODE) {
		try {
			await commitRoom(
				{
					id: name,
					bound: editingRoom.value?.bound || false,
					version: editingRoom.value?.version || 0,
				},
				editingRoom.value?.id || name,
			);
			roomEditor.value = false;
			toast("包厢已保存");
		} catch (error) {
			roomError.value = error.message;
		}
		return;
	}
	if (editingRoom.value) {
		const old = editingRoom.value.id;
		editingRoom.value.id = name;
		if (state.selectedRoom === old) state.selectedRoom = name;
	} else state.rooms.push({ id: name, bound: false });
	persist();
	roomEditor.value = false;
	toast("包厢已保存");
}
function chooseRoom() {
	uni.showActionSheet({
		itemList: state.rooms.map((room) => room.id + " 包厢"),
		success(result) {
			state.selectedRoom = state.rooms[result.tapIndex].id;
			persist();
		},
	});
}
function saveQR() {
	toast("当前是示意码，真实包厢码需接入服务端生成");
}
function regenerateQR() {
	uni.showModal({
		title: "包厢二维码",
		content:
			"当前展示的是设计示意二维码。接入小程序码生成接口后，可为各包厢生成有效点餐码。",
		showCancel: false,
		confirmColor: "#f57636",
	});
}
function changePhoto() {
	uni.chooseImage({
		count: 1,
		sizeType: ["compressed"],
		async success(result) {
			try {
				form.customImage = DESIGN_MODE
					? result.tempFilePaths[0]
					: await saveImage(result.tempFilePaths[0]);
			} catch (error) {
				toast(error.message);
			}
		},
	});
}
async function saveProduct() {
	formError.value = "";
	if (!form.name.trim()) {
		formError.value = "请输入餐品名称";
		return;
	}
	const price = Number(form.price);
	if (
		!/^\d+(\.\d{1,2})?$/.test(String(form.price)) ||
		!Number.isFinite(price) ||
		price <= 0 ||
		price > 9999
	) {
		formError.value = "请输入 0.01–9999 元的有效售价";
		return;
	}
	const existing = state.products.find(
		(item) => item.id === state.selectedProduct,
	);
	const product = {
		...form,
		name: form.name.trim(),
		price,
		description: existing?.description || "现点现做，美味即享",
	};
	if (!DESIGN_MODE) {
		try {
			await commitProduct({
				...product,
				id: existing?.id || "food-" + Date.now(),
				version: form.version || 0,
			});
			toast("餐品已保存");
			go("16");
		} catch (error) {
			formError.value = error.message;
		}
		return;
	}
	if (existing) Object.assign(existing, product);
	else state.products.push({ ...product, id: "food-" + Date.now() });
	persist();
	toast("餐品已保存");
	go("16");
}
</script>
