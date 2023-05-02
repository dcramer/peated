export default {
  ENV: process.env.NODE_ENV || "production",
  DEBUG: process.env.NODE_ENV === "development",
  PORT: process.env.PORT || 4000,
  HOST: process.env.HOST || "http://localhost",
  CORS_HOST: process.env.CORS_HOST || "http://localhost:5173",
  JWT_SECRET: process.env.JWT_SECRET || "",

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

  UPLOAD_PATH: process.env.UPLOAD_PATH,

  USE_GCS_STORAGE: !!process.env.USE_GCS_STORAGE,
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
  GCS_BUCKET_PATH: process.env.GCS_BUCKET_PATH,
};
