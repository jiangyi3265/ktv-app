// Crop coordinates in the original approved PNGs; all UI remains real components.
const crops = {
	delivery: {
		board: 3,
		width: 1902,
		height: 827,
		x: 1750,
		y: 152,
		w: 77,
		h: 76,
	},
	chicken: {
		board: 4,
		width: 2041,
		height: 770,
		x: 1259,
		y: 275,
		w: 102,
		h: 100,
	},
	beef: {
		board: 4,
		width: 2041,
		height: 770,
		x: 1259,
		y: 399,
		w: 102,
		h: 99,
	},
	bites: {
		board: 4,
		width: 2041,
		height: 770,
		x: 1259,
		y: 524,
		w: 102,
		h: 97,
	},
	noodle: {
		board: 2,
		width: 1904,
		height: 826,
		x: 771,
		y: 605,
		w: 84,
		h: 55,
	},
	hero: {
		board: 1,
		width: 1900,
		height: 828,
		x: 272,
		y: 232,
		w: 300,
		h: 111,
	},
	large: {
		board: 4,
		width: 2041,
		height: 770,
		x: 1653,
		y: 222,
		w: 314,
		h: 134,
	},
	qr: { board: 4, width: 2041, height: 770, x: 924, y: 264, w: 193, h: 188 },
};
// Each approved board uses a different photograph. Keep the original composition
// for that page family instead of substituting the admin menu's food photos.
const photos = {
	1: {
		chicken: [342, 401, 71, 67],
		beef: [342, 481, 71, 68],
		bites: [342, 563, 71, 66],
	},
	2: {
		chicken: [421, 400, 73, 49],
		bites: [421, 457, 73, 53],
		beef: [771, 445, 85, 56],
		noodle: [771, 605, 84, 55],
	},
	3: {
		chicken: [745, 394, 82, 78],
		bites: [745, 485, 82, 78],
		beef: [351, 567, 59, 36],
		noodle: [351, 610, 59, 39],
	},
	5: {
		chicken: [122, 337, 49, 41],
		bites: [179, 338, 49, 40],
		beef: [123, 471, 56, 41],
	},
};
const dimensions = {
	1: [1900, 828],
	2: [1904, 826],
	3: [1902, 827],
	5: [2041, 770],
};
const pagePhotos = {
	cart: { chicken: [651, 397, 72, 67], bites: [651, 479, 72, 66] },
	"03": { chicken: [1019, 234, 71, 64], bites: [1019, 313, 71, 66] },
	"04": { chicken: [1019, 234, 71, 64], bites: [1019, 313, 71, 66] },
	"06": { chicken: [770, 223, 86, 55], bites: [869, 223, 73, 55] },
	"07": { chicken: [1128, 423, 65, 46], bites: [1128, 480, 65, 47] },
	"08": { chicken: [1494, 375, 70, 49], bites: [1494, 434, 70, 52] },
	"09": { chicken: [351, 361, 61, 37], bites: [351, 407, 61, 38] },
	11: { chicken: [1136, 389, 68, 77], bites: [1136, 480, 68, 79] },
	19: { chicken: [502, 270, 50, 36], bites: [502, 318, 50, 36] },
};

export function foodCrop(name, board = 4, page = "", variant = "") {
	const key = variant || page;
	const pageRegion = pagePhotos[key]?.[name];
	const region = pageRegion || photos[board]?.[name];
	if (!region) {
		const baseName = crops[name] ? name : "chicken";
		return { ...crops[baseName], file: "base-" + baseName };
	}
	const [x, y, w, h] = region;
	const [width, height] = dimensions[board];
	return {
		board,
		width,
		height,
		x,
		y,
		w,
		h,
		file: board + "-" + (pageRegion ? key : "list") + "-" + name,
	};
}
export function allFoodCrops() {
	const result = Object.keys(crops).map((name) => ({
		...crops[name],
		file: "base-" + name,
	}));
	for (const [board, names] of Object.entries(photos))
		for (const name of Object.keys(names))
			result.push(foodCrop(name, Number(board)));
	for (const [page, names] of Object.entries(pagePhotos)) {
		const board =
			page === "cart"
				? 1
				: Number(page) <= 4
					? 1
					: Number(page) <= 8
						? 2
						: Number(page) <= 12
							? 3
							: 5;
		for (const name of Object.keys(names))
			result.push(foodCrop(name, board, page));
	}
	return result;
}
