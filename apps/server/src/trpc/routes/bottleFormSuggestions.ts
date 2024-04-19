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

  return rv;
}

export default authedProcedure
  .input(BottleInputSuggestionSchema)
  .query(bottleInputSuggestions);
