<template>
	<view class="item-list">
		<view v-for="item in items" :key="item.id" class="item-row">
			<FoodImage
				:name="item.image || item.id"
				:src="item.customImage"
				:class="{ 'food-small': compact }"
			/>
			<view class="item-info"
				><text class="item-name">{{ item.name }}</text
				><text v-if="prices" class="item-meta"
					>¥{{ item.price }} × {{ item.quantity }}</text
				></view
			>
			<text v-if="prices" class="item-amount"
				>¥{{
					money(Math.round(item.price * 100) * item.quantity)
				}}</text
			>
			<text v-else class="item-quantity"
				><text class="quantity-symbol">×</text>{{ item.quantity }}</text
			>
			<button
				v-if="checkable"
				class="check-box"
				:class="{ checked: checkedIds.includes(item.id) }"
				:aria-label="'核对' + item.name"
				@click="$emit('check', item.id)"
			>
				<AppIcon
					v-if="checkedIds.includes(item.id)"
					name="check"
					color="white"
					:size="17"
				/>
			</button>
		</view>
	</view>
</template>
<script setup>
import FoodImage from "./FoodImage.vue";
import AppIcon from "./AppIcon.vue";
import { money } from "../common/domain.mjs";
defineProps({
	items: Array,
	prices: { type: Boolean, default: true },
	compact: Boolean,
	checkable: Boolean,
	checkedIds: { type: Array, default: () => [] },
});
defineEmits(["check"]);
</script>
