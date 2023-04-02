export default {
  ENV: process.env.NODE_ENV || "production",
  PORT: process.env.PORT || 4000,
  HOST: process.env.HOST || "http://localhost",
  CORS_HOST: process.env.CORS_HOST || "http://localhost:3000/",
  JWT_SECRET: process.env.JWT_SECRET || "",

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
};
