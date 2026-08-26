import { createAdaptorServer } from "@hono/node-server";
import { mockApp } from "./app";

const host = "localhost";
const port = 4999;

const server = createAdaptorServer({
  fetch: mockApp.fetch,
  hostname: host,
});

server.listen(port, host, () => {
  console.log(`Mock API exposed at http://${host}:${port}/`);
});
