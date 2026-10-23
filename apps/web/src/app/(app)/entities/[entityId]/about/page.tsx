import config from "@peated/web/config";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { AboutPage, WithContext } from "schema-dts";

import {
  getCitationNumbers,
  getKeyFacts,
  getOwners,
} from "@peated/web/features/entityAbout/entityAbout";
import {
  EntityAboutArticle,
  EntityAboutLead,
} from "@peated/web/features/entityAbout/entityAboutArticle.stylex";
import { EntityAboutFacts } from "@peated/web/features/entityAbout/entityAboutFacts.stylex";
import { EntityAboutLayout } from "@peated/web/features/entityAbout/entityAboutLayout.stylex";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getEntityPage } from "@peated/web/lib/entityPage.server";
import { getPageEntityAbout } from "@peated/web/lib/publicCatalog.server";
import { getCatalogSeoMetadata } from "@peated/web/lib/seoMetadata";
import { serializeJsonLd } from "@peated/web/lib/structuredData";
import { getEntityUrl } from "@peated/web/lib/urls";

import { EntityImageGallery } from "../entityImageGallery.stylex";

export async function generateMetadata(props: {
  params: Promise<{ entityId: string }>;
}): Promise<Metadata> {
  const { entityId } = await props.params;
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  const { about } = await getPageEntityAbout(entity.id);
  if (!entity.hasAbout || !about?.lead) notFound();
  return getCatalogSeoMetadata({
    title: `About ${entity.name}`,
    description: about.lead.sentences.map((s) => s.text).join(" "),
    url: `${getEntityUrl(entity)}/about`,
  });
}

export default async function EntityAboutPage(props: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await props.params;
  const entity = await getEntityPage(parseCatalogRouteId(entityId));
  const { about, counts } = await getPageEntityAbout(entity.id);
  if (!entity.hasAbout || !about?.lead) notFound();

  const keyFacts = getKeyFacts(about, entity.name);
  const citationNumbers = getCitationNumbers(about, keyFacts);
  const entityUrl = new URL(getEntityUrl(entity), config.URL_PREFIX).href;
  const opened = about.events.find((event) => event.kind === "opened");
  // Adds the founding date to the Organization the entity layout describes.
  const jsonLd: WithContext<AboutPage> = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    url: `${entityUrl}/about`,
    name: `About ${entity.name}`,
    mainEntity: {
      "@type": "Organization",
      "@id": `${entityUrl}#organization`,
      foundingDate: opened?.date,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <EntityAboutLayout
        lead={
          <EntityAboutLead
            citationNumbers={citationNumbers}
            lead={about.lead}
          />
        }
        article={
          <EntityAboutArticle
            about={about}
            citationNumbers={citationNumbers}
            counts={counts}
            currentYear={new Date().getUTCFullYear()}
            entity={entity}
          />
        }
        rail={
          <>
            {entity.images?.length ? (
              <EntityImageGallery entity={entity} />
            ) : null}
            <EntityAboutFacts
              citationNumbers={citationNumbers}
              keyFacts={keyFacts}
              owners={getOwners(about)}
            />
          </>
        }
      />
    </>
  );
}
