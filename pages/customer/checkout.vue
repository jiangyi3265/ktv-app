<template><Checkout page="03" :query="query" /></template>
<script setup>
import { usePageQuery } from "../../common/usePageQuery";
import Checkout from "../../views/Checkout.vue";
const query = usePageQuery();
</script>
