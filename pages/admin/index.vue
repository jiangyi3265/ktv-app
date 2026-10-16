<template><AdminBasics page="13" :query="query" /></template>
<script setup>
import { usePageQuery } from "../../common/usePageQuery";
import AdminBasics from "../../views/AdminBasics.vue";
const query = usePageQuery();
</script>
