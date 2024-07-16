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

  if (!rv.distillers && input.distillers) {
    rv.distillers = await Promise.all(
      input.distillers.map((d) => getEntity(d, ctx)),
    );
  }

  // remove duplicate brand name prefix on bottle name
  // e.g. Hibiki 12-year-old => Hibiki
  if (rv.brand) {
    rv.name = stripPrefix(rv.name, `${rv.brand.name} `);
  }

  if (rv.name) {
    const [name, statedAge] = normalizeBottleName(rv.name, rv.statedAge);

    rv.name = name;
    rv.statedAge = statedAge;
  }

  // TODO: we want to remove the year from the name in mid-match
  const vintageYearMatch = rv.name.match(
    /(\b(\d{4})\b)|(\((\d{4})(?: release)?\))/i,
  );
  if (vintageYearMatch) {
    if (!rv.vintageYear) {
      const vintageYear = parseInt(
        vintageYearMatch[1] || vintageYearMatch[4],
        10,
      );
      if (vintageYear > 1900 && vintageYear < new Date().getFullYear() + 1)
        rv.vintageYear = vintageYear;
    }
  }
  if (rv.vintageYear) {
    // TODO: regex this
    rv.name = stripSuffix(rv.name, ` ${rv.vintageYear}`);
    rv.name = stripSuffix(rv.name, ` (${rv.vintageYear})`);
    rv.name = stripSuffix(rv.name, ` (${rv.vintageYear} release)`);
    rv.name = stripSuffix(rv.name, ` (${rv.vintageYear} Release)`);
  }

  const match = rv.name.match(/(\d{1,2})-year-old($|\s)/i);
  if (match) {
    rv.name = `${match[1]}-year-old ${rv.name.replace(/(\b\d{1,2}-year-old)($|\s)/i, "")}`;
  }

  rv.name = rv.name.replace(/\n/, " ").replace(/\s{2,}/, " ");

  return rv;
}

function stripSuffix(value: string, suffix: string) {
  if (value.endsWith(suffix)) {
    return value.substring(0, value.length - suffix.length);
  }
  return value;
}

function stripPrefix(value: string, prefix: string) {
  if (value.startsWith(prefix)) {
    return value.substring(prefix.length);
  }
  return value;
}

export default authedProcedure.input(BottleInputSchema).query(bottleNormalize);
