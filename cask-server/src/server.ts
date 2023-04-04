import buildFastify from "./app";
import config from "./config";

const start = async () => {
  try {
    const fastify = await buildFastify();
    await fastify.listen({ port: config.PORT as number });
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

start();
