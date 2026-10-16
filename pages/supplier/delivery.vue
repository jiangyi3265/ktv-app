<template><Supplier page="12" :query="query" /></template>
<script setup>
import { usePageQuery } from "../../common/usePageQuery";
import Supplier from "../../views/Supplier.vue";
const query = usePageQuery();
</script>
