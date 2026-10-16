<template>
	<AppShell
		:page="page"
		title="包厢点餐"
		align="left"
		tabs="customer"
		active-tab="01"
		content-class="catalog-scroll"
	>
		<template #header-action
			><!-- #ifdef H5 --><view class="mini-capsule"
				><AppIcon name="brand-wechat" color="green" :size="21" /><view
					class="capsule-divider" /><AppIcon
					name="headset"
					:size="19" /></view
			><!-- #endif --></template
		>
		<view class="catalog-intro">
			<view class="room-chip"
				><AppIcon name="map-pin" filled :size="19" /><text
					>{{ state.room }} 包厢</text
				><text class="text-green">· 已识别</text></view
			>
			<text class="catalog-heading">好好吃饭，尽兴开唱</text>
			<text class="catalog-subtitle">美味相伴，歌声更动人</text>
		</view>
		<FoodImage name="hero" class="catalog-hero" />
		<view class="catalog-menu">
			<view class="catalog-search"
				><view class="search-field"
					><AppIcon name="search" color="gray" :size="18" /><input
						v-model="search"
						placeholder="搜索餐品"
						confirm-type="search"
						aria-label="搜索餐品" /></view
			></view>
			<view class="menu-columns">
				<view class="category-rail"
					><button
						v-for="category in ['推荐', '主食', '小吃']"
						:key="category"
						:class="{ active: selectedCategory === category }"
						@click="selectedCategory = category"
					>
						{{ category }}
					</button></view
				>
				<view class="catalog-products">
					<view
						v-for="product in products"
						:key="product.id"
						class="catalog-product"
					>
						<FoodImage
							:name="product.image"
							:src="product.customImage"
							class="catalog-food"
						/>
						<view class="catalog-product-info"
							><text class="item-name">{{ product.name }}</text
							><text class="product-description">{{
								product.description
							}}</text
							><view class="between"
								><text class="catalog-price"
									><text class="price-currency">¥</text
									>{{ product.price }}</text
								><button
									class="add-button"
									:aria-label="'添加' + product.name"
									@click="changeQuantity(product.id, 1)"
								>
									<AppIcon
										name="plus"
										color="white"
										:size="18"
									/></button></view
						></view>
					</view>
					<view v-if="!products.length" class="empty-state"
						><AppIcon name="search" color="gray" :size="30" /><text
							>没有找到相关餐品</text
						><button
							class="text-button"
							@click="
								search = '';
								selectedCategory = '推荐';
							"
						>
							查看全部餐品
						</button></view
					>
				</view>
			</view>
		</view>
		<template #footer
			><view class="cart-dock"
				><button
					class="cart-summary"
					aria-label="打开已选餐品"
					@click="cartOpen = true"
				>
					<text>已选 {{ cartCount }} 份</text
					><text class="price"
						><text class="price-currency">¥</text
						>{{ cartTotal }}</text
					></button
				><button
					class="primary-button"
					:disabled="!cartCount"
					@click="go('03')"
				>
					去结算
				</button></view
			></template
		>
		<template #overlay>
			<view
				v-if="cartOpen"
				class="overlay"
				@click.self="cartOpen = false"
			>
				<view class="bottom-sheet cart-sheet">
					<view class="sheet-handle" />
					<view class="sheet-heading"
						><text>已选餐品</text
						><button class="muted" @click="clearCart">
							清空
						</button></view
					>
					<view v-if="cartItems.length" class="cart-lines"
						><view
							v-for="item in cartItems"
							:key="item.id"
							class="cart-line"
							><FoodImage
								variant="cart"
								:name="item.image"
								:src="item.customImage" /><view
								class="fill stack"
								><text class="item-name">{{ item.name }}</text
								><text class="catalog-price"
									><text class="price-currency">¥</text
									>{{ item.price }}</text
								></view
							><view class="stepper"
								><button
									:aria-label="'减少' + item.name"
									@click="changeQuantity(item.id, -1)"
								>
									<AppIcon
										name="minus"
										color="gray"
										:size="17"
									/></button
								><text>{{ item.quantity }}</text
								><button
									class="stepper-add"
									:aria-label="'增加' + item.name"
									@click="changeQuantity(item.id, 1)"
								>
									<AppIcon
										name="plus"
										color="white"
										:size="18"
									/></button></view></view
					></view>
					<view v-else class="empty-state"
						><AppIcon
							name="shopping-bag"
							color="gray"
							:size="35"
						/><text>还没有选择餐品</text
						><button class="text-button" @click="cartOpen = false">
							去看看菜单
						</button></view
					>
					<view class="cart-room"
						><AppIcon
							name="map-pin"
							color="green"
							:size="20" /><text class="fill"
							>送至 {{ state.room }} 包厢</text
						><AppIcon name="chevron-right" color="gray" :size="19"
					/></view>
					<view class="between cart-total"
						><text>共 {{ cartCount }} 份</text
						><text class="price"
							><text class="price-currency">¥</text
							>{{ cartTotal }}</text
						></view
					>
					<button
						class="primary-button full-width"
						:disabled="!cartCount"
						@click="go('03')"
					>
						去结算
					</button>
				</view>
			</view>
		</template>
	</AppShell>
</template>
<script setup>
import { computed, ref, watch, provide } from "vue";
provide("artboard", 1);
import AppShell from "../components/AppShell.vue";
import AppIcon from "../components/AppIcon.vue";
import FoodImage from "../components/FoodImage.vue";
import { go } from "../common/pages";
import {
	state,
	cartItems,
	cartCount,
	cartTotal,
	changeQuantity,
	clearCart,
	persist,
} from "../common/store";
const props = defineProps({ page: String, query: Object });
provide(
	"referencePage",
	computed(() => props.page),
);
const cartOpen = ref(props.page === "02");
const search = ref("");
const selectedCategory = ref("推荐");
watch(
	() => props.query,
	(value) => {
		const room = value?.room || value?.scene;
		if (room) {
			try {
				const parsed = decodeURIComponent(room)
					.replace(/^room=/, "")
					.toUpperCase();
				state.room = /^[A-Z0-9\u4e00-\u9fa5-]{1,12}$/.test(parsed)
					? parsed
					: "";
			} catch {
				state.room = "";
			}
			persist();
		}
	},
	{ immediate: true },
);
const products = computed(() =>
	state.products.filter(
		(product) =>
			product.onSale &&
			(search.value
				? product.name.includes(search.value)
				: selectedCategory.value === "推荐"
					? product.id !== "noodle"
					: product.category === selectedCategory.value),
	),
);
</script>
