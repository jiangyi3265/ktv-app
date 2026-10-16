<template>
	<view class="food-image"
		><image
			v-if="src"
			:src="resolvedSrc"
			class="uploaded-food"
			mode="aspectFill" /><image
			v-else
			:src="`/static/food/${crop.file}.png`"
			class="food-source"
			style="width: 100%; height: 100%"
			mode="aspectFill"
	/></view>
</template>
<script setup>
import { computed, inject, unref } from "vue";
import { foodCrop } from "../common/artwork.mjs";
import { apiUrl } from "../common/api";
const props = defineProps({
	name: { type: String, default: "chicken" },
	src: { type: String, default: "" },
	variant: String,
});
const artboard = inject("artboard", 4);
const resolvedSrc = computed(() =>
	props.src.startsWith("/ktv-api/") ? apiUrl(props.src) : props.src,
);
const referencePage = inject("referencePage", "");
// Reuse only food / QR regions of the approved artwork. All UI is rendered by components.
const crop = computed(() =>
	foodCrop(props.name, artboard, unref(referencePage), props.variant),
);
</script>
