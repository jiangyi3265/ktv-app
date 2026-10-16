const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require(process.env.SHARP_MODULE || "sharp");
const root = path.resolve(__dirname, "..");
const names = [
	"tools-kitchen-2",
	"chevron-right",
	"chevron-left",
	"antenna-bars-5",
	"wifi",
	"battery-4",
	"receipt",
	"briefcase",
	"clipboard-check",
	"home",
	"settings",
	"check",
	"search",
	"map-pin",
	"plus",
	"minus",
	"x",
	"brand-wechat",
	"coin",
	"shopping-bag",
	"truck-delivery",
	"bell",
	"volume",
	"chef-hat",
	"door",
	"qrcode",
	"pencil",
	"users",
	"credit-card",
	"info-circle",
	"user",
	"shield-check",
	"lock",
	"photo",
	"camera",
	"circle-check",
	"clipboard-list",
	"device-floppy",
	"logout",
	"chevron-down",
	"map-pin-check",
	"cloche",
	"paper-bag",
	"headset",
	"delivery-bag",
];
const customIcons = {
	coin: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M8.4 6.6 12 12l3.6-5.4M8 11.8h8M8 14.5h8M12 12v6" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>',
	cloche: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18a9 9 0 0 1 18 0H3ZM2 21h20M12 9V5M10 5h4"/></svg>',
	"delivery-bag":
		'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"><path d="M10 8h10l2 11H8L10 8ZM12 10V7a3 3 0 0 1 6 0v3M13 13c1.3 1.5 2.7 1.5 4 0M4 10h3M1 13h5M3 16h2"/></svg>',
	"paper-bag":
		'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14l2 15H3L5 7ZM5 10h14M9 7V4a3 3 0 0 1 6 0v3M15 10v12"/></svg>',
	"map-pin-check":
		'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22S4.5 15.3 4.5 9a7.5 7.5 0 0 1 15 0c0 6.3-7.5 13-7.5 13Z"/><path d="m8.5 9.8 2.5 2.5 4.7-5"/></svg>',
	"shield-check":
		'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 8 3v7c0 4.6-4.8 8.1-8 10-3.2-1.9-8-5.4-8-10V5l8-3Z"/><path d="m8 11.8 2.7 2.7 5.3-5.4"/></svg>',
	door: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V6c0-5.2 16-5.2 16 0v16M7 22V7c0-3.1 10-3.1 10 0v15M2 22h20M9 13v.1"/></svg>',
	receipt:
		'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2.5"/><path d="M8 7h8M8 12h8M8 17h5"/></svg>',
	"brand-wechat":
		'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><defs><mask id="a"><rect width="24" height="24" fill="white"/><circle cx="6" cy="7.3" r=".9" fill="black"/><circle cx="11" cy="7.3" r=".9" fill="black"/><ellipse cx="16" cy="14.6" rx="7.3" ry="5.9" fill="black"/></mask><mask id="b"><rect width="24" height="24" fill="white"/><circle cx="13.7" cy="13.4" r=".8" fill="black"/><circle cx="18.3" cy="13.4" r=".8" fill="black"/></mask></defs><path mask="url(#a)" fill="currentColor" d="M9 2C4 2 1 5 1 8.5c0 2 1 3.8 3 5l-.8 3 3.5-1.7c.8.2 1.5.3 2.3.3 4.5 0 8-2.9 8-6.6S13.5 2 9 2Z"/><path mask="url(#b)" fill="currentColor" d="M16 9c4 0 7 2.5 7 5.5 0 1.8-1 3.2-2.5 4.2l.5 2.3-2.8-1.4c-.7.2-1.4.3-2.2.3-3.8 0-7-2.4-7-5.4S12 9 16 9Z"/></svg>',
};
const colors = {
	yellow: "#f5c800",
	ink: "#182326",
	orange: "#f57636",
	green: "#329375",
	gray: "#879096",
	white: "#ffffff",
};
async function main() {
	await fs.mkdir(path.join(root, "static/icons"), { recursive: true });
	for (const name of names) {
		const source =
			customIcons[name] ||
			(await fs.readFile(
				path.join(
					root,
					"node_modules/@tabler/icons/icons/outline",
					name + ".svg",
				),
				"utf8",
			));
		for (const [color, hex] of Object.entries(colors)) {
			await sharp(Buffer.from(source.replace(/currentColor/g, hex)))
				.resize(160, 160)
				.png()
				.toFile(
					path.join(root, "static/icons", `${name}-${color}.png`),
				);
		}
	}
	for (const name of [
		"home",
		"settings",
		"clipboard-text",
		"briefcase",
		"clipboard-check",
		"user",
		"circle-check",
		"map-pin",
	]) {
		const source = await fs.readFile(
			path.join(
				root,
				"node_modules/@tabler/icons/icons/filled",
				name + ".svg",
			),
			"utf8",
		);
		for (const [color, hex] of Object.entries(colors)) {
			await sharp(Buffer.from(source.replace(/currentColor/g, hex)))
				.resize(160, 160)
				.png()
				.toFile(
					path.join(
						root,
						"static/icons",
						`${name}-filled-${color}.png`,
					),
				);
		}
	}
	await fs.copyFile(
		path.join(root, "node_modules/@tabler/icons/LICENSE"),
		path.join(root, "static/icons/LICENSE.txt"),
	);
	console.log("Prepared icon assets.");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
