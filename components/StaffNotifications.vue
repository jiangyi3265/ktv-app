<template>
  <view class="staff-notices">
    <view class="between"><text class="bold">{{ title }}</text><button class="text-button" :disabled="busy || loading" @click="load">刷新</button></view>
    <text class="muted small">{{ description }}</text>
    <text v-if="loading" class="muted">正在读取提醒状态…</text>
    <template v-else>
      <text v-if="!info.enabled" class="notice-warning">订单提醒暂未启用，请在订单页面查看进度。</text>
      <text v-else-if="!info.templateReady" class="notice-warning">{{ customer ? '商家尚未配置顾客订单提醒，请在我的订单查看进度。' : '请先在电脑后台「接单通知」配置对应的微信模板。' }}</text>
      <text v-else-if="info.bound && info.credits > 0" class="notice-ok">{{ info.longTerm ? '微信长期订阅已登记' : '已授权，预计还可接收 ' + info.credits + ' 条提醒' }}</text>
      <text v-else class="notice-warning">{{ info.bound ? '微信已连接，仍需授权接收提醒。' : '尚未连接微信提醒。' }}</text>
      <text v-if="info.groupConfigured && !customer" class="notice-ok">企业微信群提醒已配置，请确认你已在接单群内。</text>
      <template v-if="mini && info.templateReady && info.enabled">
        <text v-if="nonce" class="muted small">连接成功，请继续点击下方按钮，在微信弹窗中选择允许。</text>
        <button class="outline-button" :disabled="busy" @click="nonce ? subscribe() : bind()">{{ busy ? '处理中…' : nonce ? '授权接收微信提醒' : info.bound ? '再订阅一次微信提醒' : '连接微信提醒' }}</button>
        <text class="muted small">{{ info.longTerm ? '实际接收取决于微信通知设置。' : '一次授权只能接收一条提醒。需要更多进度提醒时，请再次订阅；勾选保持选择不会变成无限次。' }}</text>
        <button v-if="info.bound" class="text-button stop-notice" :disabled="busy" @click="unbind">关闭我的微信提醒</button>
      </template>
      <text v-else-if="info.templateReady && !mini" class="muted small">请使用微信打开小程序，在此页面连接并授权提醒。</text>
    </template>
    <text v-if="error" class="form-error">{{ error }}</text>
  </view>
</template>
<script setup>
import { ref, reactive, computed, watch, onUnmounted } from 'vue';
import { connection, notificationRequest } from '../common/store';
const info = reactive({}), busy = ref(false), loading = ref(true), error = ref(''), nonce = ref('');
const customer = computed(() => connection.role === 'customer');
const title = computed(() => customer.value ? '订单进度提醒' : connection.role === 'admin' ? '商家订单提醒' : '接单提醒');
const description = computed(() => customer.value ? '接单、配送、送达和退款进度，通过微信通知你。' : connection.role === 'admin' ? '顾客付款下单、备货接单、缺货和超时未接单时提醒你。' : '有新的待接订单或订单转派给你时提醒，请先核对库存再接单。');
let mini = false, alive = true, epoch = 0, read = 0;
// #ifdef MP-WEIXIN
mini = true;
// #endif
const current = (version) => alive && version === epoch && connection.ready;
onUnmounted(() => { alive = false; epoch++; });
async function load() {
  if (!connection.ready) return;
  const version = epoch, sequence = ++read;
  loading.value = true; error.value = '';
  try {
    const result = await notificationRequest('/status');
    if (current(version) && sequence === read) Object.assign(info, result);
  } catch (e) { if (current(version) && sequence === read) error.value = e.message; }
  finally { if (current(version) && sequence === read) loading.value = false; }
}
watch(() => [connection.role, connection.ready], () => {
  epoch++; read++; nonce.value = ''; busy.value = false; loading.value = true; error.value = '';
  Object.keys(info).forEach(k => delete info[k]);
  if (connection.ready) load();
}, { immediate: true, flush: 'sync' });
async function bind() {
  if (busy.value) return;
  const version = epoch; busy.value = true; error.value = '';
  try {
    // #ifdef MP-WEIXIN
    const login = await new Promise((resolve, reject) => uni.login({ provider: 'weixin', success: resolve, fail: reject }));
    if (!current(version)) return;
    const result = await notificationRequest('/bind', 'POST', { code: login.code });
    if (!current(version)) return;
    nonce.value = result.nonce; info.templateId = result.templateId;
    await load();
    // #endif
  } catch (e) { if (current(version)) error.value = e.message || '微信连接失败，请重试'; }
  finally { if (current(version)) busy.value = false; }
}
function subscribe() {
  if (busy.value || !nonce.value) return;
  const version = epoch, authorization = nonce.value, templateId = info.templateId;
  busy.value = true; error.value = '';
  // Keep the WeChat authorization dialog directly in the user tap, before any await.
  // #ifdef MP-WEIXIN
  uni.requestSubscribeMessage({ tmplIds: [templateId],
    async success(result) {
      if (!current(version)) return;
      try {
        const accepted = result[templateId] === 'accept';
        const status = await notificationRequest('/subscribe', 'POST', { nonce: authorization, templateId, accepted });
        if (!current(version)) return;
        Object.assign(info, status); nonce.value = '';
        if (!accepted) error.value = '你未允许微信提醒，仍可在订单页面查看进度。';
      } catch (e) { if (current(version)) { error.value = e.message; nonce.value = ''; } }
      finally { if (current(version)) busy.value = false; }
    },
    fail() { if (current(version)) { error.value = '微信授权未完成，请重新连接后再试。'; nonce.value = ''; busy.value = false; } }
  });
  // #endif
  // #ifndef MP-WEIXIN
  busy.value = false;
  // #endif
}
async function unbind() {
  if (busy.value) return;
  const version = epoch; busy.value = true; error.value = '';
  try {
    await notificationRequest('/bind', 'DELETE');
    if (!current(version)) return;
    nonce.value = ''; await load();
  } catch (e) { if (current(version)) error.value = e.message; }
  finally { if (current(version)) busy.value = false; }
}
</script>
<style scoped>
.staff-notices {
	width: 100%;
	text-align: left;
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 14px 0 18px;
	margin-bottom: 14px;
	border-bottom: 1px solid var(--line);
	font-size: 14px;
	line-height: 1.6;
}
.staff-notices .small {
	font-size: 12px;
	line-height: 1.6;
}
.notice-warning {
	color: #94613a;
}
.notice-ok {
	color: #28785e;
}
.stop-notice {
	align-self: flex-start;
}
.staff-notices .outline-button {
	min-height: 44px;
	font-size: 15px;
}
</style>
