import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { allFoodCrops } from "../common/artwork.mjs";
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || "sharp");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await fs.mkdir(path.join(root, "static/food"), { recursive: true });
for (const crop of allFoodCrops()) {
	await sharp(path.join(root, `design-reference/board-${crop.board}.png`))
		.extract({ left: crop.x, top: crop.y, width: crop.w, height: crop.h })
		.png({ compressionLevel: 9, effort: 10 })
		.toFile(path.join(root, `static/food/${crop.file}.png`));
}
console.log(`Extracted ${allFoodCrops().length} lossless artwork regions.`);
