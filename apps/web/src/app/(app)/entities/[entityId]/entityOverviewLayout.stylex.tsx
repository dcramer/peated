import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { LoadingList, LoadingPlaceholder } from "@peated/web/components";
import { colors, space } from "../../../../styles/tokens.stylex";

const NARROW = "@media (max-width: 759px)";
const loadingDelays = [0, 1, 2, 3] as const;

export function EntityOverviewLayout({
  catalogSections,
  facts,
  media,
  relationships,
}: {
  catalogSections: ReactNode;
  facts: ReactNode;
  media: ReactNode;
  relationships: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.overviewGrid)}>
      <div {...stylex.props(styles.catalog)}>
        <div {...stylex.props(styles.facts)}>{facts}</div>
        <div {...stylex.props(styles.catalogSections)}>{catalogSections}</div>
      </div>

      <aside {...stylex.props(styles.details)}>
        <div {...stylex.props(styles.media)}>{media}</div>
        <div {...stylex.props(styles.relationships)}>{relationships}</div>
      </aside>
    </div>
  );
}

function LoadingSection({ label, rows }: { label: string; rows: 3 | 4 }) {
  return (
    <div {...stylex.props(styles.loadingSection)}>
      <LoadingPlaceholder preset="heading" />
      <LoadingList label={label} rows={rows} />
    </div>
  );
}

/** Reserves the entity overview geometry while the route streams. */
export function EntityOverviewLoading() {
  return (
    <div aria-busy="true" aria-label="Loading entity overview" role="status">
      <EntityOverviewLayout
        facts={
          <div aria-hidden="true" {...stylex.props(styles.loadingFacts)}>
            {Array.from({ length: 4 }, (_, index) => (
              <span key={index} {...stylex.props(styles.loadingFact)}>
                <LoadingPlaceholder
                  delay={loadingDelays[index % loadingDelays.length]}
                  preset="metadata"
                />
                <LoadingPlaceholder
                  delay={loadingDelays[(index + 1) % loadingDelays.length]}
                  preset="text"
                />
              </span>
            ))}
          </div>
        }
        media={
          <div aria-hidden="true" {...stylex.props(styles.loadingMedia)} />
        }
        catalogSections={
          <div aria-hidden="true" {...stylex.props(styles.loadingSections)}>
            <LoadingSection label="Loading entity releases" rows={4} />
            <LoadingSection label="Loading popular bottles" rows={4} />
          </div>
        }
        relationships={
          <div aria-hidden="true" {...stylex.props(styles.loadingSections)}>
            <LoadingSection label="Loading entity relationships" rows={3} />
            <LoadingSection label="Loading related entities" rows={3} />
          </div>
        }
      />
    </div>
  );
}

const styles = stylex.create({
  overviewGrid: {
    display: "grid",
    gridTemplateAreas: {
      default: '"catalog details"',
      [NARROW]: '"facts" "media" "catalogSections" "relationships"',
    },
    gridTemplateColumns: {
      default: "minmax(0, 1fr) 336px",
      [NARROW]: "minmax(0, 1fr)",
    },
    minWidth: 0,
    alignItems: "start",
    columnGap: space.x12,
  },
  catalog: {
    gridArea: "catalog",
    minWidth: 0,
    paddingTop: space.x4,
    display: {
      [NARROW]: "contents",
    },
  },
  details: {
    gridArea: "details",
    minWidth: 0,
    display: {
      [NARROW]: "contents",
    },
  },
  facts: {
    gridArea: "facts",
    minWidth: 0,
  },
  catalogSections: {
    gridArea: "catalogSections",
    minWidth: 0,
  },
  media: {
    gridArea: "media",
    minWidth: 0,
  },
  relationships: {
    gridArea: "relationships",
    minWidth: 0,
  },
  loadingFacts: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(auto-fit, minmax(160px, 1fr))",
      "@media (max-width: 559px)": "minmax(0, 1fr)",
    },
    gap: space.x4,
    paddingBottom: space.x4,
  },
  loadingFact: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x1,
  },
  loadingMedia: {
    width: "100%",
    aspectRatio: "8 / 5",
    marginTop: space.x4,
    backgroundColor: colors.inset,
  },
  loadingSections: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x8,
  },
  loadingSection: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x3,
    paddingTop: space.x6,
  },
});
