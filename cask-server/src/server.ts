import fastify from "fastify";
import prismaPlugin from "./plugins/prisma";
import bottlesRoute from "./routes/bottles";

const app = fastify({
  logger: true,
});

app.register(prismaPlugin);

// routes
app.register(bottlesRoute);

await app.listen(3000, "0.0.0.0");

// app.listen({ port: 3000 }, function (err, address) {
//   if (err) {
//     app.log.error(err);
//     process.exit(1);
//   }
// });

// const app = fastify();
