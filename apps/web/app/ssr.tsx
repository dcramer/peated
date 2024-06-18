import { getRouterManifest } from "@tanstack/start/router-manifest";
import {
  createRequestHandler,
  defaultStreamHandler,
} from "@tanstack/start/server";

import { createRouter } from "./router";

export default createRequestHandler({
  createRouter,
  getRouterManifest,
})(defaultStreamHandler);
