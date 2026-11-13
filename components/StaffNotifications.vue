<template>
	<view class="staff-notices">
		<view class="between"
			><text class="bold">接单提醒</text
			><button class="text-button" :disabled="busy" @click="load">
				刷新
			</button></view
		>
		<text v-if="!info.enabled" class="notice-warning"
			>后台通知暂未启用，请及时查看订单列表。</text
		>
		<text v-else-if="info.groupConfigured" class="notice-ok"
			>已配置企业微信群提醒，请确认你已在接单群内。</text
		>
		<text v-else-if="info.bound && info.credits > 0" class="notice-ok">{{
			info.longTerm
				? "微信长期订阅已登记"
				: "已登记微信订阅，剩余约 " + info.credits + " 次"
		}}</text>
		<text v-else class="notice-warning"
			>离开小程序后可能漏单，请开启微信提醒或联系商家配置接单群。</text
		>
		<template v-if="mini && info.templateReady && info.enabled">
			<button
				class="outline-button"
				:disabled="busy"
				@click="nonce ? subscribe() : bind()"
			>
				{{
					busy
						? "处理中…"
						: nonce
							? "授权接收微信提醒"
							: info.bound
								? "再订阅一次微信提醒"
								: "连接微信提醒"
				}}
			</button>
			<text class="muted small">{{
				info.longTerm
					? "消息由微信发送，实际接收取决于微信通知设置。"
					: "微信一次性订阅每授权一次可接收一条消息，用完后请重新订阅。勾选保持选择也不会变成无限次。"
			}}</text>
			<button
				v-if="info.bound"
				class="text-button stop-notice"
				:disabled="busy"
				@click="unbind"
			>
				关闭我的微信提醒
			</button>
		</template>
		<text v-else-if="!info.groupConfigured" class="muted small">{{
			!info.templateReady
				? "商家可在电脑后台「接单通知」完成通知配置。"
				: "微信订阅请在微信小程序内开启。"
		}}</text>
		<text class="muted small"
			>{{
				connection.role === "supplier"
					? "前台声音每分钟提醒待接订单；"
					: "缺货反馈会提醒商家；"
			}}超过 {{ info.overdueMinutes || 5 }} 分钟未接单也会提醒商家。</text
		>
		<text v-if="error" class="form-error">{{ error }}</text>
	</view>
</template>
<script setup>
import { ref, reactive, watch, onUnmounted } from "vue";
import { connection, notificationRequest } from "../common/store";
const info = reactive({ enabled: true }),
	busy = ref(false),
	error = ref(""),
	nonce = ref("");
let mini = false,
	alive = true;
// #ifdef MP-WEIXIN
mini = true;
// #endif
onUnmounted(() => {
	alive = false;
});
async function load() {
	if (!connection.ready) return;
	try {
		const data = await notificationRequest("/status");
		if (alive) Object.assign(info, data);
	} catch (e) {
		if (alive) error.value = e.message;
	}
}
watch(
	() => connection.ready,
	(v) => {
		if (v) load();
		else {
			nonce.value = "";
			Object.keys(info).forEach((k) => delete info[k]);
		}
	},
	{ immediate: true },
);
async function bind() {
	busy.value = true;
	error.value = "";
	try {
		// #ifdef MP-WEIXIN
		const login = await new Promise((resolve, reject) =>
			uni.login({ provider: "weixin", success: resolve, fail: reject }),
		);
		const result = await notificationRequest("/bind", "POST", {
			code: login.code,
		});
		nonce.value = result.nonce;
		info.templateId = result.templateId;
		await load();
		// #endif
	} catch (e) {
		error.value = e.message || "微信连接失败，请重试";
	} finally {
		busy.value = false;
	}
}
function subscribe() {
	if (busy.value) return;
	busy.value = true;
	error.value = "";
	// Keep the subscription dialog directly inside this user tap, before network awaits.
	// #ifdef MP-WEIXIN
	uni.requestSubscribeMessage({
		tmplIds: [info.templateId],
		async success(result) {
			try {
				const accepted = result[info.templateId] === "accept";
				Object.assign(
					info,
					await notificationRequest("/subscribe", "POST", {
						nonce: nonce.value,
						templateId: info.templateId,
						accepted,
					}),
				);
				nonce.value = "";
				if (!accepted)
					error.value =
						"未允许微信提醒，请保持页面打开或使用接单群。";
			} catch (e) {
				error.value = e.message;
				nonce.value = "";
			} finally {
				busy.value = false;
			}
		},
		fail() {
			error.value = "微信授权未完成，请重新连接后再试。";
			nonce.value = "";
			busy.value = false;
		},
	});
	// #endif
	// #ifndef MP-WEIXIN
	busy.value = false;
	// #endif
}
async function unbind() {
	busy.value = true;
	try {
		await notificationRequest("/bind", "DELETE");
		nonce.value = "";
		await load();
	} catch (e) {
		error.value = e.message;
	} finally {
		busy.value = false;
	}
}
</script>
<style scoped>
.staff-notices {
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
