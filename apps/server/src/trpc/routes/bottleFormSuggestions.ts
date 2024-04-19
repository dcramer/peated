import { normalizeBottleName } from "@peated/server/lib/normalize";
import { parseDetailsFromName } from "@peated/server/lib/smws";
import {
  BottleInputSuggestionSchema,
  type EntityInputSchema,
} from "@peated/server/schemas";
import { type BottleFormSuggestions } from "@peated/server/types";
import { TRPCError } from "@trpc/server";
import { type z } from "zod";
import { authedProcedure } from "..";
import { type Context } from "../context";
import { createCaller } from "../router";

async function getEntity(
  caller: ReturnType<typeof createCaller>,
  input?: number | z.infer<typeof EntityInputSchema> | null,
) {
  if (!input) return null;

  if (typeof input === "number") {
    try {
      return await caller.entityById(input);
    } catch (err) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Entity not found with (ID=${input})`,
        cause: err,
      });
    }
  }
  return input;
}

export async function bottleInputSuggestions({
  input,
  ctx,
}: {
  input: z.infer<typeof BottleInputSuggestionSchema>;
  ctx: Context;
}) {
  const user = ctx.user;
  if (!user) {
    throw new TRPCError({
      message: "Unauthorzed!",
      code: "UNAUTHORIZED",
    });
  }

  const rv: BottleFormSuggestions = {
    mandatory: {
      name: null,
      category: null,
      brand: null,
      bottler: null,
      distillers: null,
      statedAge: null,
    },
    suggestions: {
      name: null,
      category: null,
      brand: [],
      bottler: [],
      distillers: [],
      statedAge: null,
    },
  };

  const caller = createCaller(ctx);

  const brand = await getEntity(caller, input.brand);

  if (brand?.name.toLowerCase() === "the scotch malt whisky society") {
    rv.mandatory.bottler = brand;

    if (input.name) {
      const details = parseDetailsFromName(input.name);
      if (details) {
        rv.mandatory.category = details.category;
        rv.suggestions.name = details.name;

        if (details.distiller) {
          const distiller = await getEntity(caller, {
            name: details.distiller,
          });
          if (distiller) rv.mandatory.distillers = [distiller];
        }
      }
    }
  }

  // remove duplicate brand name prefix on bottle name
  // e.g. Hibiki 12-year-old => Hibiki
  let name = rv.mandatory.name ?? input.name;
  let statedAge = rv.mandatory.statedAge ?? input.statedAge;
  if (brand && name && name.startsWith(brand.name)) {
    rv.mandatory.name = name.substring(brand.name.length + 1);
  }

  // TODO: if we're going to use this for both inputs + the server, we should
  // probably consider what this all means
  // my thoughts are that 'suggestions' will appear in the UI, and are never enforced
  // however, mandatory also shows (similar to suggestions), but gets enforced on
  // submission. this basically means we suggest you change to the required final form
  // but to ease the UX burden, we only actually freeze that when its submitted
  if (name && statedAge) {
    [name, statedAge] = normalizeBottleName(name, statedAge);

    rv.mandatory.name = name;
    rv.mandatory.statedAge = statedAge;
  }

  return rv;
}

export default authedProcedure
  .input(BottleInputSuggestionSchema)
  .query(bottleInputSuggestions);
