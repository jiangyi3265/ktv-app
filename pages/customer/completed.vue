<template><CustomerOrders page="08" :query="query" /></template>
<script setup>
import { usePageQuery } from "../../common/usePageQuery";
import CustomerOrders from "../../views/CustomerOrders.vue";
const query = usePageQuery();
</script>
