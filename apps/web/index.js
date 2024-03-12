import { installGlobals } from "@remix-run/node";

installGlobals();

if (process.env.NODE_ENV === "production") {
  require("./server-build/index.js");
} else {
  require("./server/index.ts");
}
