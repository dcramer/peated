import { fastify } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
const oauthPlugin = require("@fastify/oauth2");

import { router } from "./routes";
import config from "./config";

const app = fastify({
  logger: { level: config.ENV === "development" ? "info" : "warn" },
});

app.register(helmet);
app.register(cors, { credentials: true, origin: config.CORS_HOST });

app.register(oauthPlugin, {
  name: "googleOAuth2",
  scope: ["profile", "email"],
  credentials: {
    client: {
      id: "<CLIENT_ID>",
      secret: "<CLIENT_SECRET>",
    },
    auth: oauthPlugin.GOOGLE_CONFIGURATION,
  },
  startRedirectPath: "/auth/google",
  callbackUri: `${config.HOST}:${config.PORT}/auth/google/callback`,
  callbackUriParams: {
    access_type: "offline",
  },
});

app.register(router);

export default app;
