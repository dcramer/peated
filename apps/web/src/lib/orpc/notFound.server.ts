"server only";

import { isORPCNotFoundError } from "@peated/orpc/client/errors";
import { notFound } from "next/navigation";

export async function resolveOrNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (isORPCNotFoundError(error)) {
      notFound();
    }

    throw error;
  }
}
