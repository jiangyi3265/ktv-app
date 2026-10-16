// QA contact sheets only. These images are never used as application UI.
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require(process.env.SHARP_MODULE || "sharp");
const root = path.resolve(__dirname, "..");
const groups = [
	[1, 4],
	[5, 8],
	[9, 12],
	[13, 17],
	[18, 22],
];
(async () => {
	for (const [index, [first, last]] of groups.entries()) {
		const images = [];
		let height = 0;
		for (let number = first; number <= last; number++) {
			const buffer = await sharp(
				path.join(
					root,
					"qa/screenshots",
					`${String(number).padStart(2, "0")}.png`,
				),
			)
				.resize({ width: 300 })
				.toBuffer();
			const metadata = await sharp(buffer).metadata();
			height = Math.max(height, metadata.height);
			images.push({
				input: buffer,
				left: 12 + (number - first) * 314,
				top: 12,
			});
		}
		await sharp({
			create: {
				width: (last - first + 1) * 314 + 12,
				height: height + 24,
				channels: 3,
				background: "#eae7e1",
			},
		})
			.composite(images)
			.png()
			.toFile(path.join(root, "qa", `group-${index + 1}.png`));
	}
	console.log("Updated five review contact sheets.");
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
