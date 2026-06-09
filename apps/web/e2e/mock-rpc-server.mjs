import http from "node:http";

import {
  buildBottle,
  buildCollectionBottle,
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
  testUser,
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

const collectionStateByToken = new Map();
let collectionBottleId = 1;

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
      if (input?.bottle === createdBottleId) {
        sendRpcResponse(
          response,
          buildBottle({
            id: createdBottleId,
            name: createdBottleName,
            brand: testBrand,
          }),
        );
        return true;
      }

      if (typeof input?.bottle !== "number") {
        sendRpcError(response, "Unexpected bottle details payload");
        return true;
      }

      sendRpcResponse(
        response,
        input.bottle === existingBottleId
          ? existingBottle
          : buildBottleForId(input.bottle),
      );
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
    case "users/details":
      if (
        input?.user === "me" ||
        input?.user === testUser.id ||
        input?.user === testUser.username
      ) {
        sendRpcResponse(response, testUser);
        return true;
      }

      sendRpcError(response, "Unexpected user details payload");
      return true;
    case "users/badgeList":
      sendRpcResponse(response, emptyList);
      return true;
    case "users/regionList":
      sendRpcResponse(response, {
        results: [],
        totalCount: 0,
      });
      return true;
    case "users/flavorList":
      sendRpcResponse(response, {
        results: [],
        totalCount: 0,
        totalScore: 0,
      });
      return true;
    case "notifications/count":
      sendRpcResponse(response, { count: 0 });
      return true;
    case "collections/bottles/list":
      sendRpcResponse(response, listCollectionBottles(request, input));
      return true;
    case "collections/bottles/create":
      mutateCollectionBottle(request, input, "create");
      sendRpcResponse(response, {});
      return true;
    case "collections/bottles/delete":
      mutateCollectionBottle(request, input, "delete");
      sendRpcResponse(response, {});
      return true;
    case "bottles/tags":
      if (typeof input?.bottle !== "number") {
        sendRpcError(response, "Unexpected bottle tags payload");
        return true;
      }

      sendRpcResponse(response, {
        results: [],
        totalCount: 0,
      });
      return true;
    case "comments/list":
      sendRpcResponse(response, emptyList);
      return true;
    case "reviews/list":
      if (input?.bottle !== undefined && typeof input.bottle !== "number") {
        sendRpcError(response, "Unexpected reviews list payload");
        return true;
      }

      sendRpcResponse(response, emptyList);
      return true;
    default:
      return false;
  }
}

/**
 * Collection state is isolated by access token so parallel browser projects can
 * mutate Favorites and Library independently against one mock RPC server.
 */
function getCollectionState(request) {
  const authorization = request.headers.authorization;
  const token =
    (Array.isArray(authorization) ? authorization[0] : authorization)?.replace(
      /^Bearer\s+/i,
      "",
    ) ?? "anonymous";

  if (!collectionStateByToken.has(token)) {
    collectionStateByToken.set(token, {
      default: new Map(),
      library: new Map(),
    });
  }

  return collectionStateByToken.get(token);
}

function getCollection(input) {
  if (input?.collection !== "default" && input?.collection !== "library") {
    throw new Error(`Unexpected collection ${input?.collection}`);
  }

  return input.collection;
}

/**
 * Match the API's base-bottle versus specific-release distinction in the mock
 * store key.
 */
function getCollectionKey(input) {
  return `${input?.bottle}:${input?.release ?? "base"}`;
}

function mutateCollectionBottle(request, input, action) {
  if (input?.user !== "me" || typeof input?.bottle !== "number") {
    throw new Error("Unexpected collection mutation payload");
  }

  const state = getCollectionState(request);
  const collection = getCollection(input);
  const entries = state[collection];
  const key = getCollectionKey(input);

  if (action === "delete") {
    entries.delete(key);
    return;
  }

  if (!entries.has(key)) {
    entries.set(
      key,
      buildCollectionBottle({
        id: collectionBottleId++,
        bottle:
          input.bottle === existingBottleId
            ? existingBottle
            : buildBottleForId(input.bottle),
      }),
    );
  }
}

function buildBottleForId(id) {
  return buildBottle({
    id,
    name: `16-year-old ${id}`,
  });
}

function listCollectionBottles(request, input) {
  const state = getCollectionState(request);
  const collection = getCollection(input);
  const entries = Array.from(state[collection].entries());
  const results =
    input?.bottle === undefined
      ? entries.map(([, entry]) => entry)
      : entries
          .filter(([key]) => key === getCollectionKey(input))
          .map(([, entry]) => entry);

  return {
    results,
    rel: {
      nextCursor: null,
      prevCursor: null,
    },
  };
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
