import { CountrySchema, detailsResponse } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/countries/{country}",
    summary: "Get country details",
    description: "Get a country by its URL name",
    operationId: "getCountry",
  })
  .input(z.object({ country: z.string() }))
  // TODO(response-envelope): Return { data: ... } when all detail routes use the
  // same wrapper.
  .output(detailsResponse(CountrySchema));
