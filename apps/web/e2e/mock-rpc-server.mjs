import http from "node:http";

import {
  buildBottle,
  buildTasting,
  createdBottleId,
  createdBottleName,
  createdTastingId,
  emptyList,
  existingBottle,
  existingBottleId,
  suggestedTags,
  tastingNotes,
  testBrand,
} from "./rpc-fixtures.mjs";

const host = "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_API_PORT ?? 4999);

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, baggage, content-type, sentry-trace",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  Vary: "Origin",
};

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders).end();
    return;
  }

  if (request.url === "/health") {
    response.writeHead(204, corsHeaders).end();
    return;
  }

  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (url.pathname.startsWith("/rpc")) {
    const handled = await handleRpcRequest({ request, response, url });
    if (!handled) {
      request.resume();
    }
    return;
  }

  response.writeHead(404, corsHeaders).end();
});

server.listen(port, host, () => {
  console.log(`Mock RPC server listening on http://${host}:${port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

async function handleRpcRequest({ request, response, url }) {
  const path = url.pathname.replace(/^\/rpc\/?/, "");
  const input = await readRpcInput(request, url);

  switch (path) {
    case "entities/list":
      if (input?.query === testBrand.name) {
        sendRpcResponse(response, {
          ...emptyList,
          results: [testBrand],
        });
        return true;
      }
      return false;
    case "bottles/create": {
      if (input?.name !== createdBottleName || input?.brand !== testBrand.id) {
        sendRpcError(response, "Unexpected bottle create payload");
        return true;
      }

      const bottle = buildBottle({
        id: createdBottleId,
        name: createdBottleName,
        brand: testBrand,
      });
      sendRpcResponse(response, bottle);
      return true;
    }
    case "bottles/details": {
      let bottle;
      if (input?.bottle === createdBottleId) {
        bottle = buildBottle({
          id: createdBottleId,
          name: createdBottleName,
          brand: testBrand,
        });
      } else if (input?.bottle === existingBottleId) {
        bottle = existingBottle;
      } else {
        sendRpcError(response, "Unexpected bottle details payload");
        return true;
      }

      sendRpcResponse(response, bottle);
      return true;
    }
    case "bottles/suggestedTags":
      if (![createdBottleId, existingBottleId].includes(input?.bottle)) {
        sendRpcError(response, "Unexpected suggested tags payload");
        return true;
      }

      sendRpcResponse(response, suggestedTags);
      return true;
    case "tastings/create": {
      if (
        ![createdBottleId, existingBottleId].includes(input?.bottle) ||
        input?.rating !== 2 ||
        input?.notes !== tastingNotes
      ) {
        sendRpcError(response, "Unexpected tasting create payload");
        return true;
      }

      const bottle =
        input?.bottle === createdBottleId
          ? buildBottle({
              id: createdBottleId,
              name: createdBottleName,
              brand: testBrand,
              totalTastings: 1,
              hasTasted: true,
            })
          : buildBottle({
              ...existingBottle,
              totalTastings: 1,
              hasTasted: true,
            });
      sendRpcResponse(response, {
        tasting: buildTasting({
          bottle,
          notes: input?.notes,
          rating: input?.rating,
          tags: input?.tags ?? [],
        }),
        awards: [],
      });
      return true;
    }
    case "tastings/details":
      if (input?.tasting !== createdTastingId) {
        sendRpcError(response, "Unexpected tasting details payload");
        return true;
      }

      sendRpcResponse(response, buildTasting());
      return true;
    case "comments/list":
      sendRpcResponse(response, emptyList);
      return true;
    default:
      return false;
  }
}

async function readRpcInput(request, url) {
  const data = url.searchParams.get("data");
  if (data) {
    return JSON.parse(data).json;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const body = await readBody(request);
  if (!body) return undefined;

  return JSON.parse(body).json;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendRpcResponse(response, data) {
  response
    .writeHead(200, {
      ...corsHeaders,
      "Content-Type": "application/json",
    })
    .end(JSON.stringify({ json: data }));
}

function sendRpcError(response, message) {
  response
    .writeHead(400, {
      ...corsHeaders,
      "Content-Type": "application/json",
    })
    .end(JSON.stringify({ error: { code: "BAD_REQUEST", message } }));
}
