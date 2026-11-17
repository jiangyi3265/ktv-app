export function miniApiOrigin(value) {
	if (!value?.trim()) throw new Error("小程序必须配置 VITE_KTV_API_ORIGIN，不能使用 H5 的相对接口地址。");
	let url;
	try { url = new URL(value.trim()); } catch { throw new Error("小程序接口地址必须是完整的 HTTPS 域名。"); }
	if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
		url.hostname === "localhost" || url.hostname.endsWith(".localhost") || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(":")) {
		throw new Error("小程序接口地址必须是 HTTPS 域名，不能含账号、路径、查询参数或本机/IP 地址。");
	}
	return url.origin;
}
