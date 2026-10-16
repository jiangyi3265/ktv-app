<template>
	<view v-if="!connection.ready" class="connection-gate">
		<text class="card-heading">{{
			connection.needsLogin
				? role === "admin"
					? "KTV 管理员登录"
					: "食堂账号登录"
				: "连接门店服务"
		}}</text>
		<template v-if="connection.needsLogin">
			<input
				v-model="username"
				class="login-input"
				placeholder="登录账号"
				aria-label="登录账号"
				:disabled="busy"
			/>
			<input
				v-model="password"
				class="login-input"
				password
				placeholder="登录密码"
				aria-label="登录密码"
				:disabled="busy"
				@confirm="submit"
			/>
			<button class="primary-button" :disabled="busy" @click="submit">
				{{ busy ? "正在登录…" : "登录" }}
			</button>
			<text class="muted small"
				>请使用 KTV 分配的账号，权限由门店管理。</text
			>
		</template>
		<template v-else>
			<text class="muted">{{
				connection.loading
					? "正在同步餐品与订单…"
					: "暂时无法连接，请检查网络"
			}}</text>
			<button
				v-if="!connection.loading"
				class="primary-button"
				@click="activate(role)"
			>
				重新连接
			</button>
		</template>
		<text v-if="error || connection.error" class="form-error">{{
			error || connection.error
		}}</text>
	</view>
</template>
<script setup>
import { ref } from "vue";
import { connection, login, activate } from "../common/store";
const props = defineProps({ role: String });
const username = ref(""),
	password = ref(""),
	error = ref(""),
	busy = ref(false);
async function submit() {
	if (busy.value) return;
	error.value = "";
	busy.value = true;
	try {
		await login(username.value.trim(), password.value, props.role);
		password.value = "";
	} catch (e) {
		error.value = e.message;
	} finally {
		busy.value = false;
	}
}
</script>
<style>
.connection-gate {
	display: flex;
	flex-direction: column;
	gap: 18px;
	padding: 40px 24px;
	flex: 1;
	justify-content: center;
}
.connection-gate .login-input {
	background: #fff;
	border: 1px solid #e4e4e4;
	border-radius: 12px;
	height: 50px;
	padding: 0 14px;
	font-size: 16px;
}
.connection-gate .primary-button {
	width: 100%;
}
.sync-warning {
	background: #fff0e6;
	color: #a44a22;
	padding: 8px 14px;
	font-size: 13px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-shrink: 0;
}
.sync-warning button {
	font-size: 13px;
	color: #a44a22;
	background: transparent;
	padding: 0 5px;
}
.session-exit {
	position: absolute;
	right: 10px;
	bottom: 2px;
	font-size: 11px;
	padding: 0 4px;
	line-height: 20px;
	color: #859097;
	background: transparent;
	z-index: 1;
}
.topbar .session-exit {
	bottom: -2px;
}
</style>
