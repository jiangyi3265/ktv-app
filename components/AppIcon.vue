<template>
	<image
		class="app-icon"
		:src="`/static/icons/${assetName}-${color}.png`"
		:style="{ width: size + 'px', height: size + 'px' }"
		mode="aspectFit"
	/>
</template>
<script setup>
import { computed } from "vue";
const props = defineProps({
	name: { type: String, default: "chevron-right" },
	color: { type: String, default: "ink" },
	size: { type: Number, default: 22 },
	filled: Boolean,
});
const filledNames = {
	home: "home",
	settings: "settings",
	receipt: "clipboard-text",
	briefcase: "briefcase",
	"clipboard-check": "clipboard-check",
	user: "user",
	"circle-check": "circle-check",
	"map-pin": "map-pin",
};
const assetName = computed(() =>
	props.filled && filledNames[props.name]
		? filledNames[props.name] + "-filled"
		: props.name,
);
</script>
<style>
.app-icon {
	display: inline-block;
	flex: none;
	vertical-align: middle;
}
</style>
