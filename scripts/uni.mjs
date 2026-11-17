import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnv } from "vite";
import { miniApiOrigin } from "./mini-config.mjs";
import { verifyMiniBuild } from "./verify-mini-build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), mini = args.includes("mp-weixin"), build = args.includes("build");
const modeIndex = args.indexOf("--mode");
const mode = modeIndex >= 0 ? args[modeIndex + 1] : args.find(arg => arg.startsWith("--mode="))?.slice(7) || (build ? "production" : "development");
let origin;
if (mini) {
	try { origin = miniApiOrigin(loadEnv(mode, root, "VITE_").VITE_KTV_API_ORIGIN); }
	catch (error) { console.error(error.message); process.exit(1); }
}
const child = spawn(
	process.execPath,
	[
		path.join(root, "node_modules/@dcloudio/vite-plugin-uni/bin/uni.js"),
		...process.argv.slice(2),
	],
	{
		cwd: root,
		stdio: "inherit",
		env: {
			...process.env,
			...(mini ? { VITE_KTV_API_ORIGIN: origin } : {}),
            // Design mode also works on a fresh clone without a private .env file.
            ...(process.argv.includes("design") ? { VITE_KTV_MODE: "design" } : {}),
			UNI_INPUT_DIR: root,
			UNI_OUTPUT_DIR: path.join(
				root,
				"dist",
				process.argv.includes("build") ? "build" : "dev",
				process.argv.includes("mp-weixin") ? "mp-weixin" : "h5",
			),
		},
	},
);
child.on("error", error => { console.error(error.message); process.exit(1); });
child.on("exit", async (code) => {
	if (code !== 0) process.exit(code ?? 1);
	if (mini && build) {
		try {
			const result = await verifyMiniBuild(path.join(root, "dist/build/mp-weixin"), origin);
			console.log("小程序正式接口校验通过：" + result.origin);
		} catch (error) { console.error(error.message); process.exit(1); }
	}
	process.exit(0);
});
