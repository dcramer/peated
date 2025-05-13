import { call, ORPCError } from "@orpc/server";
import {
  normalizeBottle,
  type NormalizedBottle,
} from "@peated/server/lib/normalize";
import { parseDetailsFromName } from "@peated/server/lib/smws";
import { stripPrefix } from "@peated/server/lib/strings";
import { BottleInputSchema, EntityInputSchema } from "@peated/server/schemas";
import { type BottlePreviewResult } from "@peated/server/types";
import { z } from "zod";
import { procedure } from "..";
import type { Context } from "../context";
import { requireAuth } from "../middleware";
import entityById from "./entityById";

async function getEntity(
  input: number | z.input<typeof EntityInputSchema>,
  context: Context,
) {
  if (typeof input === "number") {
    try {
      return await call(entityById, { id: input }, { context });
    } catch (err) {
      throw new ORPCError("NOT_FOUND", {
        message: `Entity not found [id: ${input}]`,
        cause: err,
      });
    }
  }
  return EntityInputSchema.parse(input);
}

export async function bottleNormalize({
  input,
  context,
}: {
  input: z.infer<typeof BottleInputSchema>;
  context: Context;
}): Promise<BottlePreviewResult & NormalizedBottle> {
  const user = context.user;
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Authentication required",
    });
  }

  const brand = await getEntity(input.brand, context);

  const rv: BottlePreviewResult = {
    ...input,
    category: input.category ?? null,
    brand,
    bottler: null,
    distillers: null,
    statedAge: input.statedAge ?? null,
    flavorProfile: input.flavorProfile ?? null,
  };

  if (rv.brand?.name.toLowerCase() === "the scotch malt whisky society") {
    rv.bottler = rv.brand;

    if (input.name) {
      const details = parseDetailsFromName(input.name);
      if (details) {
        rv.name = details.name;

        if (details.category) rv.category = details.category;

        if (details.distiller) {
          const distiller = await getEntity(
            {
              name: details.distiller,
            },
            context,
          );
          if (distiller) rv.distillers = [distiller];
        }
      }
    }
  }

  if (!rv.bottler && input.bottler) {
    rv.bottler = await getEntity(input.bottler, context);
  }

  if (!rv.distillers && input.distillers) {
    rv.distillers = await Promise.all(
      input.distillers.map((d) => getEntity(d, context)),
    );
  }

  // remove duplicate brand name prefix on bottle name
  // e.g. Hibiki 12-year-old => Hibiki
  if (rv.brand) {
    rv.name = stripPrefix(rv.name, `${rv.brand.name} `);
  }

  let normalized: NormalizedBottle = {
    name: rv.name,
    statedAge: rv.statedAge ?? null,
    vintageYear: null,
    releaseYear: null,
    caskStrength: null,
    singleCask: null,
  };

  if (rv.name) {
    normalized = normalizeBottle({
      ...rv,
      isFullName: false,
    });
  }

  return {
    ...rv,
    ...normalized,
  };
}

const BottlePreviewResultSchema = z.object({
  name: z.string(),
  statedAge: z.number().nullable(),
  vintageYear: z.number().nullable(),
  releaseYear: z.number().nullable(),
  caskStrength: z.boolean().nullish(),
  singleCask: z.boolean().nullish(),
});

export default procedure
  .use(requireAuth)
  .route({ method: "POST", path: "/bottles/validations" })
  .input(BottleInputSchema)
  .output(BottlePreviewResultSchema)
  .handler(async function ({ input, context }) {
    const normalized = await bottleNormalize({
      input,
      context,
    });

    // Extract only the properties specified in the output schema
    return {
      name: normalized.name,
      statedAge: normalized.statedAge,
      vintageYear: normalized.vintageYear,
      releaseYear: normalized.releaseYear,
      caskStrength: normalized.caskStrength,
      singleCask: normalized.singleCask,
    };
  });
