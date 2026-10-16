<template><CustomerOrders page="07" :query="query" /></template>
<script setup>
import { usePageQuery } from "../../common/usePageQuery";
import CustomerOrders from "../../views/CustomerOrders.vue";
const query = usePageQuery();
</script>
