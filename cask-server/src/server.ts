import fastify from "fastify";
import prismaPlugin from "./plugins/prisma";
import bottlesRoute from "./routes/bottles";

const app = fastify({
  logger: true,
});

app.register(prismaPlugin);

// routes
app.register(bottlesRoute);

// await app.listen(3000, "0.0.0.0");

const serverPort: number = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : 3000;

app.listen({ port: serverPort }, function (err, address) {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
