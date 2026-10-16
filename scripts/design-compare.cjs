// Compare actual UI with cropped reference screens; never used as runtime UI.
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require(process.env.SHARP_MODULE || "sharp");
const root = path.resolve(__dirname, "..");
const boards = [
	{
		board: 1,
		first: 1,
		top: 58,
		bottom: 737,
		spans: [
			[270, 574],
			[634, 939],
			[998, 1305],
			[1364, 1671],
		],
	},
	{
		board: 2,
		first: 5,
		top: 51,
		bottom: 757,
		spans: [
			[395, 697],
			[748, 1053],
			[1103, 1421],
			[1471, 1795],
		],
	},
	{
		board: 3,
		first: 9,
		top: 51,
		bottom: 765,
		spans: [
			[327, 675],
			[720, 1066],
			[1113, 1459],
			[1505, 1853],
		],
	},
	{
		board: 4,
		first: 13,
		top: 104,
		bottom: 721,
		spans: [
			[51, 416],
			[445, 810],
			[840, 1204],
			[1233, 1597],
			[1627, 1992],
		],
	},
	{
		board: 5,
		first: 18,
		top: 108,
		bottom: 729,
		spans: [
			[96, 430],
			[481, 807],
			[860, 1181],
			[1233, 1557],
			[1614, 1944],
		],
	},
];
async function main() {
	const output = path.join(root, "qa/design-compare");
	await fs.mkdir(output, { recursive: true });
	const measurements = [];
	for (const board of boards) {
		for (const [index, [left, right]] of board.spans.entries()) {
			const id = String(board.first + index).padStart(2, "0");
			const referenceHeight = Math.round(
				((board.bottom - board.top) * 390) / (right - left),
			);
			const reference = await sharp(
				path.join(root, `design-reference/board-${board.board}.png`),
			)
				.extract({
					left,
					top: board.top,
					width: right - left,
					height: board.bottom - board.top,
				})
				.resize(390, referenceHeight)
				.png()
				.toBuffer();
			const screenshotPath = path.join(root, `qa/screenshots/${id}.png`);
			const meta = await sharp(screenshotPath).metadata();
			const actual = await sharp(screenshotPath)
				.extract({
					left: 7,
					top: 7,
					width: 390,
					height: meta.height - 14,
				})
				.png()
				.toBuffer();
			const labels = Buffer.from(
				`<svg width="804" height="34"><style>text{font-family:Arial;font-size:15px;fill:#263238}</style><text x="10" y="24">${id} / REFERENCE</text><text x="412" y="24">${id} / IMPLEMENTATION</text></svg>`,
			);
			await sharp({
				create: {
					width: 804,
					height: Math.max(referenceHeight, meta.height - 14) + 44,
					channels: 3,
					background: "#e5e2dd",
				},
			})
				.composite([
					{ input: labels, left: 0, top: 0 },
					{ input: reference, left: 6, top: 38 },
					{ input: actual, left: 408, top: 38 },
				])
				.png()
				.toFile(path.join(output, `${id}.png`));
			await sharp(reference).toFile(
				path.join(output, `${id}-reference.png`),
			);
			measurements.push({
				id,
				referenceHeight,
				actualHeight: meta.height - 14,
			});
		}
	}
	await fs.writeFile(
		path.join(output, "measurements.json"),
		JSON.stringify(measurements, null, 2),
	);
	console.log(JSON.stringify(measurements));
}
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
