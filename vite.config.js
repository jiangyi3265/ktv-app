import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

export default defineConfig({
	plugins: [privateFiles(), uni()],
	server: {
		host: "127.0.0.1",
		cors: false,
		fs: {
			strict: true,
			deny: [
				"**/.local/**",
				"**/.git/**",
				"**/.env*",
				"**/*.{pem,key,p12,pfx}",
			],
		},
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

// Apply before Vite's static/@fs handlers, including encoded and raw requests.
function privateFiles() {
	const guard = (req, res, next) => {
		let path = req.url || "";
		try {
			for (let i = 0; i < 3; i++) path = decodeURIComponent(path);
		} catch {
			res.writeHead(400);
			res.end();
			return;
		}
		if (
			/(?:^|[\\/])(?:\.local|\.git|\.env[^\\/?]*)[\\/?]?|\.(?:pem|key|p12|pfx)(?:[?#]|$)/i.test(
				path,
			)
		) {
			res.writeHead(404, { "Cache-Control": "no-store" });
			res.end();
			return;
		}
		next();
	};
	return {
		name: "private-files",
		enforce: "pre",
		configureServer(s) {
			s.middlewares.use(guard);
		},
		configurePreviewServer(s) {
			s.middlewares.use(guard);
		},
	};
}
