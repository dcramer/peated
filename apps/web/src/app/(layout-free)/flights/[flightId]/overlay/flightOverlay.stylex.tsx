"use client";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { Bottle } from "@peated/server/types";
import {
  BottleIdentityRow,
  Card,
  ItemList,
  ItemListItem,
} from "@peated/web/components";
import { ClientOnly } from "@peated/web/components/clientOnly";
import QRCodeClient from "@peated/web/components/qrcode.client.stylex";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { getBottleUrl, getEntityUrl } from "@peated/web/lib/urls";
import * as stylex from "@stylexjs/stylex";
import { foundationStyles } from "../../../../../styles/foundations.stylex";
import { colors, space } from "../../../../../styles/tokens.stylex";

export type FlightOverlayProps = {
  bottles: readonly { bottle: Bottle }[];
  description?: string | null;
  flightId: string;
  name: string;
};

/** Keeps the shared flight display independent from the main application shell. */
export function FlightOverlay({
  bottles,
  description,
  flightId,
  name,
}: FlightOverlayProps) {
  return (
    <main {...stylex.props(foundationStyles.document, styles.screen)}>
      <div {...stylex.props(styles.content)}>
        <header {...stylex.props(styles.header)}>
          <p {...stylex.props(foundationStyles.microLabel, styles.eyebrow)}>
            Whisky flight
          </p>
          <h1 {...stylex.props(foundationStyles.pageTitle)}>{name}</h1>
          {description ? (
            <p {...stylex.props(foundationStyles.body, styles.description)}>
              {description}
            </p>
          ) : null}
        </header>
        <div {...stylex.props(styles.layout)}>
          <Card padding="none">
            <ItemList ariaLabel="Flight bottles">
              {bottles.map(({ bottle }) => (
                <ItemListItem key={bottle.id}>
                  <BottleIdentityRow
                    brand={bottle.brand.name}
                    brandHref={getEntityUrl({
                      id: bottle.brand.id,
                      kind: "brand",
                    })}
                    href={getBottleUrl(bottle)}
                    imageUrl={bottle.imageUrl}
                    metadata={getBottleMetadata(bottle).split(" · ")}
                    name={formatBottleDisplayName(bottle, {
                      includeBrand: false,
                    })}
                  />
                </ItemListItem>
              ))}
            </ItemList>
          </Card>
          <aside {...stylex.props(styles.qr)}>
            <Card>
              <ClientOnly>
                {() => (
                  <QRCodeClient
                    value={`${window.location.protocol}//${window.location.host}/flights/${flightId}`}
                  />
                )}
              </ClientOnly>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}

const styles = stylex.create({
  screen: {
    minHeight: "100dvh",
    backgroundColor: colors.ground,
    color: colors.ink,
  },
  content: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "960px",
    marginRight: "auto",
    marginLeft: "auto",
    paddingTop: { default: space.x12, "@media (max-width: 639px)": space.x6 },
    paddingRight: { default: space.x6, "@media (max-width: 639px)": space.x3 },
    paddingBottom: space.x12,
    paddingLeft: { default: space.x6, "@media (max-width: 639px)": space.x3 },
  },
  header: {
    display: "flex",
    maxWidth: "720px",
    flexDirection: "column",
    rowGap: space.x3,
    marginBottom: space.x8,
  },
  eyebrow: { margin: 0, color: colors.accentDeep },
  description: { margin: 0, color: colors.inkMuted },
  layout: {
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr) 240px",
      "@media (max-width: 759px)": "minmax(0, 1fr)",
    },
    alignItems: "start",
    gap: space.x6,
  },
  qr: { "@media (max-width: 759px)": { display: "none" } },
});
