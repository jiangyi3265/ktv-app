<template>
	<view class="progress-steps" :class="{ green }"
		><view
			v-for="(label, index) in labels"
			:key="label"
			class="progress-step"
			:class="{ done: index <= current, current: index === current }"
			><view class="step-node"
				><AppIcon
					v-if="numbered && index < current"
					name="check"
					color="white"
					:size="16"
				/><text v-else-if="numbered">{{ index + 1 }}</text></view
			><text>{{ label }}</text></view
		></view
	>
</template>
<script setup>
import AppIcon from "./AppIcon.vue";
defineProps({
	labels: {
		type: Array,
		default: () => ["已付款", "制作中", "配送中", "已送达"],
	},
	current: { type: Number, default: 2 },
	green: Boolean,
	numbered: Boolean,
});
</script>
