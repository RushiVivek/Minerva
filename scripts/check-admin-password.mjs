import { config } from "dotenv";
import { scryptSync, timingSafeEqual } from "node:crypto";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const password = process.argv[2];
const encoded = process.env.ADMIN_PASSWORD_HASH?.trim();
if (!password || !encoded) {
  console.error("Usage: npm run auth:check -- '<admin-password>'");
  process.exit(1);
}

const [algorithm, salt, expectedHex] = encoded.split("$");
if (algorithm !== "scrypt" || !salt || !expectedHex) {
  console.error("ADMIN_PASSWORD_HASH must be a complete scrypt$...$... value");
  process.exit(1);
}

const actual = scryptSync(password, salt, 64);
const expected = Buffer.from(expectedHex, "hex");
const valid =
  actual.length === expected.length && timingSafeEqual(actual, expected);
console.log(valid ? "Admin password matches ADMIN_PASSWORD_HASH" : "Admin password does not match ADMIN_PASSWORD_HASH");
process.exit(valid ? 0 : 1);
