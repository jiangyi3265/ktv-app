import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

export default defineConfig({
	plugins: [uni()],
	server: {
		host: "0.0.0.0",
		port: 5174,
		strictPort: true,
		proxy: {
			"/ktv-api": {
				target:
					process.env.KTV_BACKEND_ORIGIN || "http://127.0.0.1:8080",
				changeOrigin: true,
			},
		},
	},
	build: { sourcemap: false },
});
