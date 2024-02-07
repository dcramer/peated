import { CATEGORY_LIST } from "@peated/server/constants";
import { type BottleInputSchema } from "@peated/server/schemas";
import { type Category } from "@peated/server/types";
import { getUrl } from "@peated/worker/scraper";
import { type z } from "zod";
import { SMWS_DISTILLERY_CODES } from "../constants";
import { trpcClient } from "../lib/api";
import { getCategoryFromCask } from "../lib/smws";

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

  data.items.forEach((item) => {
    const caskName = item.name;
    if (!caskName) {
      console.warn(`Cannot find cask name for product`);
      return;
    }

    const statedAge = item.age;
    const caskNumber = item.cask_no;
    if (!caskNumber) {
      console.warn(`Cannot find cask number: ${caskName}`);
      return;
    }

    const distillerMatch = caskNumber.match(/([A-Z0-9]+)\.[0-9]+/i);
    if (!distillerMatch) {
      console.warn(`Cannot find distiller: ${caskName}`);
      return;
    }
    const distillerNo = distillerMatch[1];
    if (!distillerNo) {
      console.warn(`Cannot find distiller: ${caskName}`);
      return;
    }

    const rawCategory = getCategoryFromCask(caskNumber);
    if (rawCategory && !CATEGORY_LIST.includes(rawCategory as any)) {
      console.warn(`Unsupported spirit: ${rawCategory}`);
      return;
    }

    const category = rawCategory as Category;

    cb({
      name: `${caskNumber} ${caskName}`,
      category,
      statedAge,
      brand: {
        name: "The Scotch Malt Whisky Society",
      },
      distillers: SMWS_DISTILLERY_CODES[distillerNo]
        ? [
            {
              name: SMWS_DISTILLERY_CODES[distillerNo],
            },
          ]
        : [],
    });
  });
}

if (typeof require !== "undefined" && require.main === module) {
  main();
}
