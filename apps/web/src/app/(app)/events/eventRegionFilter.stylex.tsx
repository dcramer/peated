import * as stylex from "@stylexjs/stylex";

import { ButtonLink } from "@peated/web/components";
import { colors, fonts, space } from "../../../styles/tokens.stylex";
import type { EventRegion, EventRegionOption } from "./eventRegionData";

export function EventRegionFilter({
  options,
  selectedRegion,
  total,
  visible,
}: {
  options: readonly EventRegionOption[];
  selectedRegion: EventRegion | null;
  total: number;
  visible: number;
}) {
  return (
    <section aria-label="Event region" {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.row)}>
        <span {...stylex.props(styles.label)}>Show events in</span>
        <nav aria-label="World regions" {...stylex.props(styles.options)}>
          <ButtonLink
            aria-current={!selectedRegion ? "page" : undefined}
            href="/events"
            size="sm"
            variant={!selectedRegion ? "accent" : "tonal"}
          >
            <span>All regions</span>
            <span {...stylex.props(styles.count)}>{total}</span>
          </ButtonLink>
          {options.map((option) => {
            const current = selectedRegion?.slug === option.slug;
            return (
              <ButtonLink
                aria-current={current ? "page" : undefined}
                href={`/events?region=${option.slug}`}
                key={option.slug}
                size="sm"
                variant={current ? "accent" : "tonal"}
              >
                <span>{option.label}</span>
                <span {...stylex.props(styles.count)}>{option.count}</span>
              </ButtonLink>
            );
          })}
        </nav>
      </div>
      <div {...stylex.props(styles.summary)}>
        {selectedRegion
          ? `Showing ${visible} upcoming ${visible === 1 ? "event" : "events"} in ${selectedRegion.label}`
          : `Showing ${total} upcoming ${total === 1 ? "event" : "events"} worldwide`}
      </div>
    </section>
  );
}

const styles = stylex.create({
  root: {
    paddingTop: space.x4,
    paddingBottom: space.x4,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: `${space.x3} ${space.x4}`,
    flexWrap: "wrap",
  },
  label: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 600,
  },
  options: {
    display: "flex",
    gap: space.x2,
    flexWrap: "wrap",
  },
  count: {
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
  },
  summary: {
    marginTop: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
  },
});
