<template>
  <view class="staff-notices">
    <view class="between"><text class="bold">{{ title }}</text><button class="text-button" :disabled="busy || loading" @click="load">刷新</button></view>
    <text class="muted small">{{ description }}</text>
    <text v-if="loading" class="muted">正在读取提醒状态…</text>
    <template v-else>
      <text v-if="!info.enabled" class="notice-warning">订单提醒暂未启用，请在订单页面查看进度。</text>
      <text v-else-if="!info.templateReady" class="notice-warning">{{ customer ? '商家尚未配置顾客订单提醒，请在我的订单查看进度。' : '请先在电脑后台「接单通知」配置微信模板。' }}</text>
      <text v-else-if="info.bound && info.credits > 0" class="notice-ok">{{ info.longTerm ? '微信长期订阅已开启' : '已开启，剩余 ' + info.credits + ' 次提醒' }}</text>
      <text v-else class="notice-warning">{{ info.longTerm ? '微信提醒未开启' : '暂无可用提醒次数，请点击下方按钮授权。' }}</text>
      <text v-if="info.groupConfigured && !customer" class="notice-ok">企业微信接单群已配置，每笔对应订单会自动通知，无需逐次订阅。</text>
      <template v-if="mini && info.templateReady && info.enabled">
        <button class="outline-button" :disabled="busy" @click="subscribe">{{ busy ? phase : info.bound && info.credits > 0 ? '再增加一次提醒' : '开启微信提醒' }}</button>
        <text class="muted small">{{ info.longTerm ? '点击按钮后，在微信弹窗中选择允许。' : '点一次按钮，在微信弹窗中选择允许，即可获得一次提醒；无须另点连接。' }}</text>
        <button v-if="info.bound" class="text-button stop-notice" :disabled="busy" @click="unbind">关闭我的微信提醒</button>
      </template>
      <text v-else-if="info.templateReady && !mini" class="muted small">请在微信小程序中点击“开启微信提醒”并允许。</text>
    </template>
    <text v-if="success" class="notice-ok" role="status">{{ success }}</text>
    <text v-if="error" class="form-error" role="alert">{{ error }}</text>
  </view>
</template>
<script setup>
import { ref, reactive, computed, watch, onUnmounted } from 'vue';
import { connection, notificationRequest } from '../common/store';
const info = reactive({}), busy = ref(false), loading = ref(true), error = ref(''), success = ref(''), phase = ref('');
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
  if (!connection.ready || busy.value) return;
  const version = epoch, sequence = ++read;
  loading.value = true; error.value = ''; success.value = '';
  try {
    const result = await notificationRequest('/status');
    if (current(version) && sequence === read) Object.assign(info, result);
  } catch (e) { if (current(version) && sequence === read) error.value = e.message; }
  finally { if (current(version) && sequence === read) loading.value = false; }
}
watch(() => [connection.role, connection.ready], () => {
  epoch++; read++; busy.value = false; loading.value = true; error.value = ''; success.value = '';
  Object.keys(info).forEach(k => delete info[k]);
  if (connection.ready) load();
}, { immediate: true, flush: 'sync' });
function subscribe() {
  if (busy.value || loading.value || !info.enabled || !info.templateReady) return;
  const version = epoch, templateId = info.templateId;
  read++; busy.value = true; error.value = ''; success.value = ''; phase.value = '请在微信弹窗中允许';
  // Open the system dialog synchronously in the tap handler. Bind only after consent.
  // #ifdef MP-WEIXIN
  uni.requestSubscribeMessage({ tmplIds: [templateId],
    async success(result) {
      if (!current(version)) return;
      if (result[templateId] !== 'accept') {
        error.value = result[templateId] === 'ban' ? '微信已关闭此提醒，请到小程序设置中允许订阅消息后重试。' : '本次未允许提醒。你仍可在订单页面查看进度，也可再次点击开启。';
        busy.value = false; return;
      }
      phase.value = '正在保存授权…';
      try {
        const login = await new Promise((resolve, reject) => uni.login({ provider: 'weixin', success: resolve, fail: reject }));
        if (!current(version)) return;
        const bound = await notificationRequest('/bind', 'POST', { code: login.code });
        if (!current(version)) return;
        if (bound.templateId !== templateId) throw new Error('通知模板已变更，请再次点击开启。');
        const status = await notificationRequest('/subscribe', 'POST', { nonce: bound.nonce, templateId, accepted: true });
        if (!current(version)) return;
        Object.assign(info, status);
        success.value = '授权已保存，符合条件的订单提醒会通过微信发送。';
      } catch (e) { if (current(version)) error.value = '微信已允许，但授权未能确认保存。' + (e.message || '连接失败') + ' 请再次点击开启重试。'; }
      finally { if (current(version)) busy.value = false; }
    },
    fail() { if (current(version)) { error.value = '微信授权未完成，请再次点击“开启微信提醒”；若曾拒绝并保持选择，请先在小程序设置中允许订阅消息。'; busy.value = false; } }
  });
  // #endif
  // #ifndef MP-WEIXIN
  busy.value = false;
  // #endif
}
async function unbind() {
  if (busy.value) return;
  const version = epoch; busy.value = true; error.value = ''; success.value = ''; phase.value = '正在关闭…';
  try {
    await notificationRequest('/bind', 'DELETE');
    if (!current(version)) return;
    Object.assign(info, { bound: false, credits: 0 }); success.value = '微信提醒已关闭。';
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
