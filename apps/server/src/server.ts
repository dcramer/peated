import * as Sentry from "@sentry/node-experimental";
import buildFastify from "./app";
import config from "./config";

const start = async () => {
  try {
    const fastify = await buildFastify();
    console.info(`API exposed at http://${config.HOST}:${config.PORT}/`);
    await fastify.listen({ port: config.PORT as number, host: config.HOST });
  } catch (err) {
    Sentry.captureException(err);
    console.error(`Fastify process received an error: ${err}`, err);
    process.exit(1);
  }
};

process.on("uncaughtException", (err) => {
  console.error(`uncaughtException received: ${err}`, err);
});

start();
