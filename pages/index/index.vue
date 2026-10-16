<template><Catalog page="01" :query="query" /></template>
<script setup>
import { usePageQuery } from "../../common/usePageQuery";
import Catalog from "../../views/Catalog.vue";
const query = usePageQuery();
</script>
