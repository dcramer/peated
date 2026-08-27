import { detailsResponse, FlightDetailsSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/flights/{flight}",
    summary: "Get flight details",
    description: "Get a tasting flight by its public ID",
    operationId: "getFlight",
  })
  .input(z.object({ flight: z.string() }))
  // TODO(response-envelope): Return { data: ... } when all detail routes use the
  // same wrapper.
  .output(detailsResponse(FlightDetailsSchema));
