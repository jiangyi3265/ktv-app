<template>
	<view
		><button class="text-button" @click="open = true">修改管理员密码</button
		><view v-if="open" class="overlay dialog-overlay"
			><view class="dialog"
				><text class="card-heading">管理员密码</text
				><input
					v-model="oldPassword"
					password
					class="dialog-input"
					placeholder="原密码"
				/><input
					v-model="password"
					password
					class="dialog-input"
					placeholder="新密码，至少12个字符"
				/><button class="primary-button" :disabled="busy" @click="save">
					修改密码并退出全部会话</button
				><button class="text-button" :disabled="busy" @click="close">
					取消</button
				><text v-if="error" class="form-error">{{ error }}</text></view
			></view
		></view
	>
</template>
<script setup>
import { ref } from "vue";
import { rotatePassword, logout } from "../common/store";
const oldPassword = ref(""),
	password = ref(""),
	error = ref(""),
	busy = ref(false);
const open = ref(false);
function close() {
	open.value = false;
	oldPassword.value = "";
	password.value = "";
	error.value = "";
}
async function save() {
	if (busy.value) return;
	busy.value = true;
	error.value = "";
	try {
		await rotatePassword(oldPassword.value, password.value);
		oldPassword.value = "";
		password.value = "";
		await logout();
	} catch (e) {
		error.value = e.message;
	} finally {
		busy.value = false;
	}
}
</script>
