import { parseDetailsFromName } from "@peated/server/lib/smws";
import { type BottleInputSchema } from "@peated/server/schemas";
import { getUrl } from "@peated/worker/scraper";
import { type z } from "zod";
import { trpcClient } from "../lib/api";

export default async function main() {
  await scrapeBottles(
    `https://api.smws.com/api/v1/bottles?store_id=uk&parent_id=61&page=1&sortBy=featured&minPrice=0&maxPrice=0&perPage=128`,
    async (item) => {
      if (process.env.ACCESS_TOKEN) {
        console.log(`Submitting [${item.name}]`);

        try {
          await trpcClient.bottleCreate.mutate({
            ...item,
          });
        } catch (err) {
          console.error(err);
        }
      } else {
        console.log(`Dry Run [${item.name}]`);
      }
    },
  );

  // if (process.env.ACCESS_TOKEN) {
  //   await trpcClient.externalSiteUpdate.mutate({
  //     site: "smwsa",
  //     key: "processedIssues",
  //     value: processedIssues,
  //   });
  // }
}

type SMWSPayload = {
  items: {
    name: string;
    age: number | null;
    cask_no: string;
  }[];
};

export async function scrapeBottles(
  url: string,
  cb: (bottle: z.infer<typeof BottleInputSchema>) => Promise<void>,
) {
  const body = await getUrl(url);
  const data = JSON.parse(body) as SMWSPayload;

  data.items.forEach(async (item) => {
    const caskName = item.name;
    if (!caskName) {
      console.warn(`Cannot find cask name for product`);
      return;
    }

    const statedAge = item.age;

    const details = parseDetailsFromName(`${item.cask_no} ${caskName}`);
    if (!details?.distiller) {
      console.error(`Cannot find distiller: ${item.cask_no} ${caskName}`);
      return;
    }
    if (!details?.category) {
      console.error(`Unsupported spirit: ${item.cask_no} ${caskName}`);
      return;
    }

    await cb({
      name: details.name,
      category: details.category,
      statedAge,
      brand: {
        name: "The Scotch Malt Whisky Society",
      },
      bottler: {
        name: "The Scotch Malt Whisky Society",
      },
      distillers: [
        {
          name: details.distiller,
        },
      ],
    });
  });
}

if (typeof require !== "undefined" && require.main === module) {
  main();
}
