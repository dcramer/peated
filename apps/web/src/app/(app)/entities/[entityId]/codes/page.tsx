import {
  SMWS_CATEGORY_LIST,
  SMWS_DISTILLERY_CODES,
} from "@peated/bottle-classifier/smws";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { logError } from "@peated/web/lib/log";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { getEntityUrl } from "@peated/web/lib/urls";
import { notFound } from "next/navigation";

import { EntityCodes } from "./entityCodes.stylex";

export default async function EntityCodesPage(props: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const { client } = await getAnonymousServerClient();
  const entity = await getEntityPage(Number(entityId));

  if (entity.shortName !== "SMWS") notFound();

  const { results: distillerList } = await client.smws.distillerList();
  const distillersByCode = Object.fromEntries(
    distillerList.flatMap((distiller) =>
      distiller.smwsCodes.map((code) => [code, distiller]),
    ),
  );
  const exampleDistiller = distillersByCode["4"];

  if (!exampleDistiller) {
    const error = new Error("Unable to find example distiller for SMWS codes.");
    logError(error, {
      entityId: entity.id,
      entityName: entity.name,
      entityShortName: entity.shortName,
      expectedDistillerName: SMWS_DISTILLERY_CODES[4],
      distillerCount: distillerList.length,
      distillerNames: distillerList.map((distiller) => distiller.name),
    });
    throw error;
  }

  const groups = SMWS_CATEGORY_LIST.flatMap(([categoryCode, categoryTitle]) => {
    const rows = [];

    for (let index = 1; index < 1000; index += 1) {
      const code = `${categoryCode}${index}`;
      const distillerName = SMWS_DISTILLERY_CODES[code];
      if (distillerName === undefined) break;
      const distiller = distillersByCode[code] ?? null;

      rows.push({
        code,
        country: distiller?.country?.name ?? null,
        href: distiller
          ? getEntityUrl({ id: distiller.id, kind: "distillery" })
          : undefined,
        name: distiller?.name ?? distillerName ?? "Unknown",
      });
    }

    return rows.length
      ? [{ code: categoryCode, heading: categoryTitle, rows }]
      : [];
  });

  return (
    <EntityCodes
      entityName={entity.name}
      example={{
        href: getEntityUrl({ id: exampleDistiller.id, kind: "distillery" }),
        name: exampleDistiller.name,
      }}
      groups={groups}
    />
  );
}
