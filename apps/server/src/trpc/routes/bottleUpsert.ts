import { BottleInputSchema } from "@peated/server/schemas";
import type {
  BottlePreviewResult,
  EntityInput,
  FreeformEntity,
} from "@peated/server/types";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import { modProcedure } from "..";
import { type Context } from "../context";
import { ConflictError } from "../errors";
import { bottleCreate } from "./bottleCreate";
import { bottleNormalize } from "./bottlePreview";
import { bottleUpdate } from "./bottleUpdate";

function coerceToUpsert(data: FreeformEntity): EntityInput {
  if (data.country instanceof Object) {
    return {
      ...data,
      country: data.country.name,
    };
  }
  return data as EntityInput;
}

export async function bottleUpsert({
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

  const bottleData: BottlePreviewResult & Record<string, any> =
    await bottleNormalize({ input, ctx });

  if (!bottleData.name) {
    throw new TRPCError({
      message: "Invalid bottle name.",
      code: "BAD_REQUEST",
    });
  }

  try {
    return await bottleCreate({ input, ctx });
  } catch (err) {
    if (err instanceof ConflictError) {
      return await bottleUpdate({
        input: {
          ...input,
          bottle: err.existingRow.id,
        },
        ctx,
      });
    }
    throw err;
  }
}

export default modProcedure.input(BottleInputSchema).mutation(bottleUpsert);
