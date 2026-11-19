<template>
  <AppShell page="24" title="门店服务" account-role="customer" public-page>
    <view class="service-home">
      <text class="service-heading">欢迎来到门店</text>
      <text class="service-intro">{{ canOrder ? '扫描包厢码点餐，或查看已有订单。' : (siteSettings.staffPortalEnabled ? '查看已有订单，或进入工作人员工作台。' : '查看已有订单进度与退款记录。') }}</text>
      <button v-if="canOrder" class="primary-button service-order" @click="go('01', {}, { replace: true })">进入点餐</button>
      <button class="service-orders" @click="go('06')">
        <AppIcon name="receipt" :size="30" color="orange" />
        <view class="service-copy"><text class="service-title">查看我的订单</text><text class="service-description">查看订单进度与退款记录</text></view>
        <AppIcon name="chevron-right" :size="20" color="orange" />
      </button>
      <text v-if="siteSettings.staffPortalEnabled" class="service-staff-heading">工作人员入口</text>
      <view v-if="siteSettings.staffPortalEnabled" class="service-staff">
        <button class="service-entry" @click="go('13')">
          <AppIcon name="home" :size="26" />
          <view class="service-copy"><text class="service-title">商家管理</text><text class="service-description">管理订单、账单与微信提醒</text></view>
          <AppIcon name="chevron-right" :size="20" />
        </button>
        <button class="service-entry" @click="go('09')">
          <AppIcon name="briefcase" :size="26" />
          <view class="service-copy"><text class="service-title">食堂接单</text><text class="service-description">确认库存、接单与配送</text></view>
          <AppIcon name="chevron-right" :size="20" />
        </button>
      </view>
      <text v-if="siteSettings.staffPortalEnabled" class="service-footnote">工作人员请使用门店分配的账号登录。</text>
    </view>
  </AppShell>
</template>
<script setup>
import { computed } from 'vue';
import AppShell from '../../components/AppShell.vue';
import AppIcon from '../../components/AppIcon.vue';
import { connection } from '../../common/store';
import { go } from '../../common/pages';
import { siteSettings } from '../../common/site-settings';
const canOrder = computed(() => connection.ready && connection.role === 'customer' && connection.orderingEnabled);
</script>
<style scoped>
.service-home { padding: 30px 20px 36px; color: var(--ink); }
.service-heading { display: block; font-size: 26px; line-height: 1.4; font-weight: 700; }
.service-intro { display: block; margin-top: 10px; font-size: 14px; line-height: 1.8; color: #667277; }
.service-orders { display: flex; align-items: center; gap: 14px; width: 100%; padding: 24px 18px; margin-top: 28px; border: 1px solid #f3dac8; background: #fff3e9; border-radius: 16px; text-align: left; }
.service-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.service-title { font-size: 18px; font-weight: 600; line-height: 1.5; }
.service-description { font-size: 13px; color: #667277; line-height: 1.6; }
.service-staff-heading { display: block; margin: 32px 0 10px; font-size: 13px; color: #667277; }
.service-entry { display: flex; align-items: center; gap: 14px; width: 100%; min-height: 100px; padding: 20px 8px; text-align: left; border-bottom: 1px solid var(--line); }
.service-footnote { display: block; margin-top: 22px; font-size: 12px; line-height: 1.7; color: #667277; }
.service-order { margin-top: 24px; }
</style>
