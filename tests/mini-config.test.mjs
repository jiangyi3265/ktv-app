import test from "node:test";
import assert from "node:assert/strict";
import { miniApiOrigin } from "../scripts/mini-config.mjs";

test("mini program builds reject missing, relative, insecure and malformed API origins", () => {
	for (const value of [undefined, "", "/ktv-api", "http://example.com", "https://localhost", "https://127.0.0.1", "https://[::1]", "https://name:password@example.com", "https://example.com/api", "https://example.com?token=fixture", "https://example.com/#fragment"]) assert.throws(() => miniApiOrigin(value));
});
test("mini program builds normalize an explicit HTTPS domain", () => {
	assert.equal(miniApiOrigin(" https://example.com/ "), "https://example.com");
	assert.equal(miniApiOrigin("https://example.com:8443"), "https://example.com:8443");
});
