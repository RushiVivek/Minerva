import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "./schema";

let client: ReturnType<typeof postgres> | undefined;

function getClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database access");
  }

  client ??= postgres(process.env.DATABASE_URL, {
    prepare: false,
    max: 1,
  });
  return client;
}

export function getDb() {
  return drizzle(getClient(), { schema });
}
