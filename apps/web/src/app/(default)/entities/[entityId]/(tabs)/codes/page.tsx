import {
  SMWS_CATEGORY_LIST,
  SMWS_DISTILLERY_CODES,
} from "@peated/server/src/lib/smws";
import Heading from "@peated/web/components/heading";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-static";

export async function generateMetadata({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const trpcClient = await getTrpcClient();
  const entity = await trpcClient.entityById.fetch(Number(entityId));

  return [
    {
      title: `${entity.name} Distillery Codes`,
    },
  ];
}

export default async function Page({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const trpcClient = await getTrpcClient();
  const entity = await trpcClient.entityById.fetch(Number(entityId));

  if (entity.shortName !== "SMWS") {
    return notFound();
  }

  const {
    results: [distillery],
  } = await trpcClient.entityList.fetch({
    name: SMWS_DISTILLERY_CODES[4],
  });

  return (
    <>
      <div className="prose prose-invert my-4 max-w-none">
        <p>
          {entity.name} encodes the distillery name as part of the cask numbber
          system. For example, <strong>Cask No. 4.360 Jangling dram</strong>{" "}
          means it is the <strong>360th cask</strong> from{" "}
          <strong>distillery number 4</strong>. In this case, distillery maps to{" "}
          <Link href={`/entities/${distillery.id}`}>{distillery.name}</Link>.
        </p>
        <p>
          If you find something incorrect orr missing, please{" "}
          <a href="https://github.com/dcramer/peated/issues">report an issue</a>
          .
        </p>
      </div>
      {SMWS_CATEGORY_LIST.map(([catCode, catTitle]) => {
        const distilleryList = [];
        for (
          let i = 1, distilleryName;
          (distilleryName = SMWS_DISTILLERY_CODES[`${catCode}${i}`]);
          i++
        ) {
          distilleryList.push([`${catCode}${i}`, distilleryName]);
        }

        if (!distilleryList.length) return null;

        return (
          <div className="mb-8 mt-4" key={catCode}>
            <Heading as="h3">
              {catTitle} {catCode && <>({catCode})</>}
            </Heading>
            <table className="min-w-full table-auto">
              <colgroup>
                <col className="w-4" />
              </colgroup>
              <tbody>
                {distilleryList.map(([code, name]) => {
                  return (
                    <tr key={code}>
                      <td className="border-b border-slate-800 p-3 text-sm">
                        {code}
                      </td>
                      <td className="border-b border-slate-800 p-3 text-sm">
                        {name}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
