export default {
  ENV: process.env.NODE_ENV === "production" ? "production" : "development",
  JWT_SECRET: process.env.JWT_SECRET || "",
  API_SERVER: process.env.API_SERVER || "http://localhost:4000",
};
