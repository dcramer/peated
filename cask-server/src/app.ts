import { fastify } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { router } from "./routes";
import config from "./config";

const app = fastify({
  logger: { level: config.ENV === "development" ? "info" : "warn" },
});

app.register(helmet);
app.register(cors, { credentials: true, origin: config.CORS_HOST });
app.register(router);

export default app;
