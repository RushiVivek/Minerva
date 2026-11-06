import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD_HASH: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
});

export function getEnv() {
  return envSchema.parse(process.env);
}
