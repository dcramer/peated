import { parseDetailsFromName } from "@peated/server/lib/smws";
import {
  BottleInputSuggestionSchema,
  type EntityInputSchema,
} from "@peated/server/schemas";
import { type BottleFormSuggestions } from "@peated/server/types";
import { type z } from "zod";
import { authedProcedure } from "..";
import { createCaller } from "../router";

async function getEntity(
  caller: ReturnType<typeof createCaller>,
  input?: number | z.infer<typeof EntityInputSchema> | null,
) {
  if (!input) return null;

  if (typeof input === "number") {
    return await caller.entityById(input);
  }
  return input;
}

export default authedProcedure
  .input(BottleInputSuggestionSchema)
  .query(async function ({ input, ctx }) {
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
  });
