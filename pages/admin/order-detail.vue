<template><AdminOrders page="19" :query="query" /></template>
<script setup>
import { usePageQuery } from "../../common/usePageQuery";
import AdminOrders from "../../views/AdminOrders.vue";
const query = usePageQuery();
</script>
