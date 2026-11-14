import { config } from "dotenv";
import dns from "node:dns";
import postgres from "postgres";
import { v2 as cloudinary } from "cloudinary";

dns.setDefaultResultOrder("ipv4first");
config({ path: ".env" });
config({ path: ".env.local", override: true });

const missing = [
  "DATABASE_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
].filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

let database;
let databaseError;
let cloudinaryError;

try {
  database = postgres(process.env.DATABASE_URL, {
    prepare: false,
    max: 1,
    connect_timeout: 10,
  });
  await database`select 1`;
} catch (error) {
  databaseError = error;
}

try {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  await cloudinary.api.ping();
} catch (error) {
  cloudinaryError = error;
}

if (database) await database.end();

if (databaseError) {
  console.error(`PostgreSQL check failed: ${databaseError.message}`);
} else {
  console.log("PostgreSQL connection: OK");
}
if (cloudinaryError) {
  console.error(`Cloudinary check failed: ${cloudinaryError.message}`);
} else {
  console.log("Cloudinary API connection: OK");
}
process.exit(databaseError || cloudinaryError ? 1 : 0);
