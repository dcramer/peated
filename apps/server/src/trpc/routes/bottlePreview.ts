import { normalizeBottleName } from "@peated/server/lib/normalize";
import { parseDetailsFromName } from "@peated/server/lib/smws";
import {
  BottleInputSchema,
  type EntityInputSchema,
} from "@peated/server/schemas";
import { type BottlePreviewResult } from "@peated/server/types";
import { TRPCError } from "@trpc/server";
import { type z } from "zod";
import { authedProcedure } from "..";
import { type Context } from "../context";
import { entityById } from "./entityById";

async function getEntity(
  input: number | z.infer<typeof EntityInputSchema>,
  ctx: Context,
) {
  if (typeof input === "number") {
    try {
      return await entityById({ input, ctx });
    } catch (err) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Entity not found [id: ${input}]`,
        cause: err,
      });
    }
  }
  return input;
}

export async function bottleNormalize({
  input,
  ctx,
}: {
  input: z.infer<typeof BottleInputSchema>;
  ctx: Context;
}) {
  const user = ctx.user;
  if (!user) {
    throw new TRPCError({
      message: "Unauthorzed!",
      code: "UNAUTHORIZED",
    });
  }

  const brand = await getEntity(input.brand, ctx);

  const rv: BottlePreviewResult = {
    name: input.name,
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
            ctx,
          );
          if (distiller) rv.distillers = [distiller];
        }
      }
    }
  }

  if (!rv.bottler && input.bottler) {
    rv.bottler = await getEntity(input.bottler, ctx);
  }

  // remove duplicate brand name prefix on bottle name
  // e.g. Hibiki 12-year-old => Hibiki
  let name = rv.name ?? input.name;
  let statedAge = rv.statedAge ?? input.statedAge;
  if (rv.brand && name && name.startsWith(rv.brand.name)) {
    rv.name = name.substring(rv.brand.name.length + 1);
  }

  if (name && statedAge) {
    [name, statedAge] = normalizeBottleName(name, statedAge);

    rv.name = name;
    rv.statedAge = statedAge;
  }

  return rv;
}

export default authedProcedure.input(BottleInputSchema).query(bottleNormalize);
