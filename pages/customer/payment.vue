<template><Checkout page="04" :query="query" /></template>
<script setup>
import { usePageQuery } from "../../common/usePageQuery";
import Checkout from "../../views/Checkout.vue";
const query = usePageQuery();
</script>
