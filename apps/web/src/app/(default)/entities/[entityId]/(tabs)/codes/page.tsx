"use client";

import {
  SMWS_CATEGORY_LIST,
  SMWS_DISTILLERY_CODES,
} from "@peated/server/lib/smws";
import Heading from "@peated/web/components/heading";
import Link from "@peated/web/components/link";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "next/navigation";

export const revalidate = 60;

export default function Page({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const orpc = useORPC();
  const { data: entity } = useSuspenseQuery(
    orpc.entities.details.queryOptions({
      input: { entity: Number(entityId) },
    }),
  );

  const { data } = useSuspenseQuery(orpc.smws.distillerList.queryOptions({}));
  const distillerList = data.results;

  if (entity.shortName !== "SMWS") {
    return notFound();
  }

  const exampleDistiller = distillerList.find(
    (d) => d.name.toLowerCase() === SMWS_DISTILLERY_CODES[4].toLowerCase(),
  );

  if (!exampleDistiller) {
    throw new Error("Unable to find example distiller for SMWS codes.");
  }

  const distillersByName = Object.fromEntries([
    ...distillerList.map((d) => [d.name.toLowerCase(), d]),
    ...distillerList
      .filter((d) => !!d.shortName)
      .map((d) => [d.shortName!.toLowerCase(), d]),
  ]);

  return (
    <>
      <div className="prose prose-invert my-4 max-w-none">
        <p>
          {entity.name} encodes the distillery name as part of the cask number
          system. For example, <strong>Cask No. 4.360 Jangling dram</strong>{" "}
          means it is the <strong>360th cask</strong> from{" "}
          <strong>distillery number 4</strong>. In this case, distillery maps to{" "}
          <Link href={`/entities/${exampleDistiller.id}`}>
            {exampleDistiller.name}
          </Link>
          .
        </p>
        <p>
          If you find something incorrect or missing, please{" "}
          <a href="https://github.com/dcramer/peated/issues">report an issue</a>
          .
        </p>
      </div>
      {SMWS_CATEGORY_LIST.map(([catCode, catTitle]) => {
        const categoryDistillerList: [
          string,
          string,
          (typeof distillerList)[number] | null,
        ][] = [];

        let distillerName: string;
        let i = 0;
        while (i < 1000) {
          i++;
          distillerName = SMWS_DISTILLERY_CODES[`${catCode}${i}`];
          if (typeof distillerName === "undefined") {
            break;
          }

          categoryDistillerList.push([
            `${catCode}${i}`,
            distillerName,
            distillerName
              ? distillersByName[distillerName.toLowerCase()]
              : null,
          ]);
        }

        if (!categoryDistillerList.length) return null;

        return (
          <div className="mb-8 mt-4" key={catCode}>
            <Heading as="h3">
              {catTitle} {catCode && <>({catCode})</>}
            </Heading>
            <table className="min-w-full table-auto">
              <colgroup>
                <col className="w-12" />
                <col />
                <col className="hidden w-48 sm:table-column" />
              </colgroup>
              <tbody>
                {categoryDistillerList.map(
                  ([code, distillerName, distiller]) => {
                    return (
                      <tr key={code}>
                        <td className="border-b border-slate-800 p-3 text-sm">
                          <abbr
                            title={`${entity.shortName || entity.name} ${code}`}
                          >
                            {code}
                          </abbr>
                        </td>
                        <td className="border-b border-slate-800 p-3 text-sm">
                          {distiller ? (
                            <Link
                              href={`/entities/${distiller.id}`}
                              className="hover:underline"
                            >
                              {distiller.name}
                            </Link>
                          ) : (
                            distillerName || <em>Unknown</em>
                          )}
                        </td>
                        <td className="text-muted hidden border-b border-slate-800 p-3 text-center text-sm sm:table-cell">
                          {distiller && distiller.country ? (
                            <Link
                              href={`/countries/${distiller.country.slug}`}
                              className="hover:underline"
                            >
                              {distiller.country.name}
                            </Link>
                          ) : (
                            <em>n/a</em>
                          )}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
