<template><AdminOrders page="21" :query="query" /></template>
<script setup>
import { usePageQuery } from "../../common/usePageQuery";
import AdminOrders from "../../views/AdminOrders.vue";
const query = usePageQuery();
</script>
