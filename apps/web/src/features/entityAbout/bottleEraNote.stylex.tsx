"use client";

import { hasEntityAboutPage } from "@peated/server/lib/entityAbout/display";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";

import { TextLink } from "../../components/textLink.stylex";
import { useORPC } from "../../lib/orpc/context";
import { getEntityUrl } from "../../lib/urls";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors } from "../../styles/tokens.stylex";
import { getEraContext } from "./entityAbout";

/**
 * Era rule (owner: docs/features/entity-about.md): a Bottle with exactly one
 * distiller and a vintage names the sourced era or former name that covers
 * its vintage, and nothing otherwise.
 */
export function BottleEraNote({
  distillers,
  vintageYear,
}: {
  distillers: readonly {
    id: number;
    name: string;
    kind: "distillery" | "brand" | "bottler" | "company";
  }[];
  vintageYear: number | null;
}) {
  const orpc = useORPC();
  const distiller = distillers.length === 1 ? distillers[0] : undefined;
  const aboutQuery = useQuery({
    ...orpc.entities.about.details.queryOptions({
      input: { entity: distiller?.id ?? 0 },
    }),
    enabled: Boolean(distiller && vintageYear),
  });
  const about = aboutQuery.data;
  if (!distiller || !vintageYear || !about) return null;

  const context = getEraContext(about, distiller.name, vintageYear);
  if (!context) return null;
  // Link only when the About tab exists; otherwise the note stands alone.
  const href = hasEntityAboutPage(about)
    ? `${getEntityUrl(distiller)}/about`
    : null;
  const linked = (text: string) =>
    href ? <TextLink href={href}>{text}</TextLink> : text;

  return (
    <span {...stylex.props(foundationStyles.metadata, styles.note)}>
      {context.kind === "era" ? (
        <>
          Distilled during {distiller.name}&apos;s{" "}
          {linked(`${context.span.label.toLowerCase()} years`)} (
          {context.span.start}–{context.span.end ?? "today"})
        </>
      ) : (
        <>
          Distilled when {distiller.name} was{" "}
          {linked(`called ${context.span.label}`)}
        </>
      )}
    </span>
  );
}

const styles = stylex.create({
  note: {
    display: "block",
    color: colors.inkMuted,
  },
});
