const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const routes = JSON.parse(
	require("node:fs").readFileSync(path.join(root, "pages.json"), "utf8"),
).pages;
const baselineEnd = {
	"03": ".payment-recipient",
	"05": ".success-body > .outline-button",
	"06": ".customer-order:last-child .order-actions",
	"07": ".delivery-note",
	"08": ".progress-body > .card:last-child",
	10: ".supplier-location",
	11: ".packing-note",
	13: ".business-flow",
	14: ".inline-note",
	15: ".qr-demo-note",
	17: ".edit-note",
	18: ".admin-order-card:last-child",
	19: ".exception-entry",
	20: ".permission-empty",
	21: ".permission-notes",
	22: ".record-link",
};
async function main() {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 980 },
		deviceScaleFactor: 1,
	});
	const page = await context.newPage();
	const errors = [],
		failures = [],
		checks = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("response", (response) => {
		if (response.status() >= 400)
			failures.push({ url: response.url(), status: response.status() });
	});
	await fs.mkdir(path.join(root, "qa/screenshots"), { recursive: true });
	for (let index = 0; index < routes.length; index++) {
		const id = String(index + 1).padStart(2, "0");
		await page.goto("http://127.0.0.1:5174/#/" + routes[index].path, {
			waitUntil: "networkidle",
		});
		await page.locator(".phone-screen").waitFor({ state: "visible" });
		await page.evaluate(() => document.fonts.ready);
		await page.locator(".phone-screen").screenshot({
			path: path.join(root, "qa/screenshots", `${id}.png`),
		});
		checks.push(
			await page.evaluate(
				({ id, lastSelector }) => {
					const phone = document.querySelector(".phone-screen"),
						scroll = document.querySelector(
							".page-scroll .uni-scroll-view-content",
						);
					const content = document
						.querySelector(".page-scroll")
						.getBoundingClientRect();
					const last =
						lastSelector &&
						phone
							.querySelector(lastSelector)
							?.getBoundingClientRect();
					return {
						id,
						baselineClipped: last
							? Math.max(
									0,
									Math.round(last.bottom - content.bottom),
								)
							: 0,
						title: document.querySelector(".topbar-title")
							.innerText,
						phone: phone.getBoundingClientRect().toJSON(),
						horizontalOverflow:
							document.documentElement.scrollWidth > innerWidth,
						scrollContent: scroll
							? {
									clientHeight: scroll.clientHeight,
									scrollHeight: scroll.scrollHeight,
								}
							: null,
						buttons: [
							...phone.querySelectorAll("button, uni-button"),
						].map((el) => ({
							text:
								el.innerText.trim() ||
								el.getAttribute("aria-label"),
							width: el.getBoundingClientRect().width,
							height: el.getBoundingClientRect().height,
						})),
					};
				},
				{ id, lastSelector: baselineEnd[id] },
			),
		);
		console.log(`${id}: ${checks.at(-1).title}`);
	}
	await page.setViewportSize({ width: 390, height: 844 });
	for (const index of [0, 1, 2, 5, 8, 12, 16, 20]) {
		await page.goto("http://127.0.0.1:5174/#/" + routes[index].path, {
			waitUntil: "networkidle",
		});
		await page.screenshot({
			path: path.join(
				root,
				"qa/screenshots",
				`mobile-${String(index + 1).padStart(2, "0")}.png`,
			),
		});
	}
	await fs.writeFile(
		path.join(root, "qa/visual-report.json"),
		JSON.stringify({ checks, errors, failures }, null, 2),
	);
	console.log(
		JSON.stringify({
			pages: checks.length,
			errors,
			failures,
			horizontalOverflow: checks
				.filter((item) => item.horizontalOverflow)
				.map((item) => item.id),
			clippedBaseline: checks
				.filter((item) => item.baselineClipped)
				.map((item) => ({ id: item.id, pixels: item.baselineClipped })),
		}),
	);
	await browser.close();
	if (
		errors.length ||
		failures.length ||
		checks.some((item) => item.baselineClipped)
	)
		process.exitCode = 1;
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
