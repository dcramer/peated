import { makeTRPCClient } from "@peated/server/lib/trpc";
import config from "@peated/worker/config";
import { type StorePrice } from "@peated/worker/types";
import { captureException } from "@sentry/node-experimental";

export const trpcClient = makeTRPCClient(
  config.API_SERVER,
  process.env.ACCESS_TOKEN,
  captureException,
);

export async function submitBottle(data: any) {
  try {
    await trpcClient.bottleCreate.mutate(data);
  } catch (err: any) {
    const data = err?.response?.data;
    if (!data) {
      console.error(err);
    } else {
      console.error(
        `Failed to submit bottle: ${err?.response.status} - ${JSON.stringify(
          data,
          null,
          2,
        )}`,
      );
    }
  }
}

export async function submitEntity(data: any) {
  try {
    await trpcClient.entityCreate.mutate(data);
  } catch (err: any) {
    const data = err?.response?.data;
    if (!data) {
      console.error(err.toString());
    } else {
      console.error(
        `Failed to submit entity: ${err?.response.status} -${JSON.stringify(
          data,
          null,
          2,
        )}`,
      );
    }
  }
}

export async function submitStorePrices(site: string, data: StorePrice[]) {
  try {
    await trpcClient.storePriceCreateBatch.mutate({
      // TODO: type this
      site: site as any,
      prices: data,
    });
  } catch (err: any) {
    const data = err?.response?.data;
    if (!data) {
      console.error(err.toString());
    } else {
      console.error(
        `Failed to submit prices: ${err?.response.status} -${JSON.stringify(
          data,
          null,
          2,
        )}`,
      );
    }
  }
}
