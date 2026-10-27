import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  LoadingList,
  LoadingPlaceholder,
} from "@peated/web/components/feedback.stylex";
import { colors, space } from "../../../../styles/tokens.stylex";

const NARROW = "@media (max-width: 759px)";
const loadingDelays = [0, 1, 2, 3] as const;

/**
 * Places an Entity page's parts (owner: docs/features/entity-page.md). The
 * main column reads top to bottom; the sidebar holds facts to check at a
 * glance. On phones the parts stack in one column, with facts near the top
 * and sources last.
 */
export function EntityOverviewLayout({
  lead,
  timeline,
  catalog,
  history,
  activity,
  sources,
  media,
  facts,
  relationships,
}: {
  lead?: ReactNode;
  timeline?: ReactNode;
  catalog: ReactNode;
  history?: ReactNode;
  activity?: ReactNode;
  sources?: ReactNode;
  media: ReactNode;
  facts: ReactNode;
  relationships: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.overviewGrid)}>
      <div {...stylex.props(styles.main)}>
        {lead ? <div {...stylex.props(styles.lead)}>{lead}</div> : null}
        {timeline ? (
          <div {...stylex.props(styles.timeline)}>{timeline}</div>
        ) : null}
        <div {...stylex.props(styles.catalog)}>{catalog}</div>
        {history ? (
          <div {...stylex.props(styles.history)}>{history}</div>
        ) : null}
        {activity ? (
          <div {...stylex.props(styles.activity)}>{activity}</div>
        ) : null}
        {sources ? (
          <div {...stylex.props(styles.sources)}>{sources}</div>
        ) : null}
      </div>

      <aside {...stylex.props(styles.details)}>
        <div {...stylex.props(styles.media)}>{media}</div>
        <div {...stylex.props(styles.facts)}>{facts}</div>
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
        catalog={
          <div aria-hidden="true" {...stylex.props(styles.loadingSections)}>
            <LoadingSection label="Loading entity releases" rows={4} />
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
      default: '"main details"',
      [NARROW]:
        '"lead" "media" "facts" "timeline" "catalog" "history" "activity" "relationships" "sources"',
    },
    gridTemplateColumns: {
      default: "minmax(0, 1fr) 336px",
      [NARROW]: "minmax(0, 1fr)",
    },
    minWidth: 0,
    alignItems: "start",
    columnGap: space.x12,
  },
  main: {
    gridArea: "main",
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
  lead: {
    gridArea: "lead",
    minWidth: 0,
    paddingBottom: space.x6,
  },
  timeline: {
    gridArea: "timeline",
    minWidth: 0,
    paddingTop: { default: 0, [NARROW]: space.x6 },
  },
  catalog: {
    gridArea: "catalog",
    minWidth: 0,
  },
  history: {
    gridArea: "history",
    minWidth: 0,
  },
  activity: {
    gridArea: "activity",
    minWidth: 0,
  },
  sources: {
    gridArea: "sources",
    minWidth: 0,
  },
  media: {
    gridArea: "media",
    minWidth: 0,
  },
  facts: {
    gridArea: "facts",
    minWidth: 0,
  },
  relationships: {
    gridArea: "relationships",
    minWidth: 0,
  },
  loadingFacts: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
    paddingTop: space.x6,
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
