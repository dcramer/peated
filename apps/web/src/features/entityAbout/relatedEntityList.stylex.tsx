"use client";

import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import { Button } from "../../components/button.stylex";
import { EntityIdentityRow } from "../../components/entityIdentityRow.stylex";
import { Slideout } from "../../components/slideout.stylex";
import { getEntityUrl } from "../../lib/urls";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors } from "../../styles/tokens.stylex";
import type { RelatedCounts } from "./entityAbout";

const VISIBLE_ROWS = 8;

function RelatedRows({ rows }: { rows: RelatedCounts["results"] }) {
  return (
    <ol {...stylex.props(styles.list)}>
      {rows.map((row) => (
        <li key={row.entity.id} {...stylex.props(styles.row)}>
          <EntityIdentityRow
            end={
              <span {...stylex.props(foundationStyles.metadata, styles.count)}>
                {row.count.toLocaleString("en-US")}
              </span>
            }
            href={getEntityUrl(row.entity)}
            kind={row.entity.kind}
            name={row.entity.name}
          />
        </li>
      ))}
    </ol>
  );
}

/**
 * The Entities with the most Bottles, largest first. A long list shows its
 * top rows; the rest open in a panel, full screen on phones.
 */
export function RelatedEntityList({
  counts,
  title,
  noun,
}: {
  counts: RelatedCounts;
  /** The panel's title, such as "Who bottled Brora". */
  title: string;
  /** Plural name for the button, such as "bottlers". */
  noun: string;
}) {
  const [open, setOpen] = useState(false);
  const hidden = counts.results.length - VISIBLE_ROWS;

  return (
    <>
      <RelatedRows rows={counts.results.slice(0, VISIBLE_ROWS)} />
      {hidden > 0 ? (
        <>
          <div>
            <Button onClick={() => setOpen(true)} size="sm" variant="tonal">
              Show all {counts.results.length} {noun}
            </Button>
          </div>
          <Slideout onClose={() => setOpen(false)} open={open} title={title}>
            <RelatedRows rows={counts.results} />
          </Slideout>
        </>
      ) : null}
    </>
  );
}

const styles = stylex.create({
  list: {
    display: "flex",
    flexDirection: "column",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  row: {
    borderBottomWidth: { default: "1px", ":last-child": 0 },
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  count: {
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
  },
});
