export const API_ORIGIN = (import.meta.env.VITE_KTV_API_ORIGIN || "").replace(
	/\/$/,
	"",
);
export const apiUrl = (path) => API_ORIGIN + path;
export function request(path, { method = "GET", data, token } = {}) {
	return new Promise((resolve, reject) =>
		uni.request({
			url: apiUrl("/ktv-api" + path),
			method,
			data,
			timeout: 12000,
			header: {
				"Content-Type": "application/json",
				...(token ? { "X-KTV-Token": token } : {}),
			},
			success(response) {
				if (response.statusCode >= 200 && response.statusCode < 300 &&
					!(response.data?.code && response.data.code !== 200))
					resolve(response.data);
				else {
					const error = new Error(
						response.data?.message || response.data?.msg || "服务暂不可用，请稍后重试",
					);
					error.status = response.statusCode >= 400 ? response.statusCode : response.data.code;
					reject(error);
				}
			},
			fail() {
				reject(new Error("连接服务失败，请检查网络后重试"));
			},
		}),
	);
}
export function uploadImage(filePath, token) {
	return new Promise((resolve, reject) =>
		uni.uploadFile({
			url: apiUrl("/ktv-api/images"),
			filePath,
			name: "file",
			header: { "X-KTV-Token": token },
			success(response) {
				try {
					const data = JSON.parse(response.data);
					if (response.statusCode >= 400 || !data.url)
						throw new Error(data.message || "图片上传失败");
					resolve(data.url);
				} catch (error) {
					reject(error);
				}
			},
			fail() {
				reject(new Error("图片上传失败，请重试"));
			},
		}),
	);
}
