import { type AppRouter } from "@peated/server/trpc/router";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import config from "~/config";

export function makeTRPCClient(accessToken?: string | null | undefined) {
  return createTRPCProxyClient<AppRouter>({
    transformer: undefined,
    links: [
      httpBatchLink({
        url: `${config.API_SERVER}/trpc`,
        async headers() {
          return {
            authorization: accessToken ? `Bearer ${accessToken}` : "",
          };
        },
      }),
    ],
  });
}

const trpcClient = makeTRPCClient(process.env.ACCESS_TOKEN);

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
