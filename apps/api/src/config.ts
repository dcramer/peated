import { tmpdir } from "node:os";

export default {
  ENV: process.env.NODE_ENV || "production",
  DEBUG: process.env.NODE_ENV === "development",
  PORT: process.env.PORT || 4000,
  HOST: process.env.HOST || "localhost",
  CORS_HOST: process.env.CORS_HOST || "http://localhost:5173",
  JWT_SECRET: process.env.JWT_SECRET || "",
  URL_PREFIX: process.env.URL_PREFIX || "http://localhost:4000",

  VERSION: process.env.VERSION || "",

  SENTRY_DSN: process.env.SENTRY_DSN || "",

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

  UPLOAD_PATH: process.env.UPLOAD_PATH || tmpdir(),

  USE_GCS_STORAGE: !!process.env.USE_GCS_STORAGE,
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
  GCS_BUCKET_PATH: process.env.GCS_BUCKET_PATH,

  GCP_CREDENTIALS: JSON.parse(process.env.GCP_CREDENTIALS || ""),
};
