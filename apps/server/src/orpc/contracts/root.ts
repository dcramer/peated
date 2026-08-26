import { z } from "zod";
import { contract } from "./base";

export default contract
  .route({
    method: "GET",
    path: "/",
    summary: "API root",
    description: "Get basic API information including version",
    spec: (spec) => ({
      ...spec,
      operationId: "getRoot",
    }),
  })
  .output(z.object({ version: z.string() }));
