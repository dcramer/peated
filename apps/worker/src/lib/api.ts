import { makeTRPCClient } from "@peated/server/lib/trpc";
import { captureException } from "@sentry/node-experimental";
import config from "~/config";

const trpcClient = makeTRPCClient(
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

export type StorePrice = {
  name: string;
  price: number;
  priceUnit: string;
  url: string;
  volume: number;
};

export async function submitStorePrices(storeId: number, data: StorePrice[]) {
  try {
    await trpcClient.storePriceCreateBatch.mutate({
      store: storeId,
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
