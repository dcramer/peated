import { z } from "zod";

export const OSMSchema = z.object({
  features: z.array(
    z.object({
      properties: z.object({
        addresstype: z.union([
          z.string(),
          z.enum(["country", "state", "county"]),
        ]),
        importance: z.number().gte(0).lte(1.0),
        type: z.union([z.string(), z.enum(["administrative"])]),
      }),
      geometry: z.object({
        type: z.enum(["Point"]),
        coordinates: z.tuple([z.number(), z.number()]),
      }),
    })
  ),
});
