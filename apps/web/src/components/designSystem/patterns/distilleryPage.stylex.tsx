import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../../../styles/foundations.stylex";
import { colors, controlMetrics, space } from "../../../styles/tokens.stylex";
import {
  Button,
  HistoryTimeline,
  IdStamp,
  SectionHeading,
  SpecStrip,
} from "../components";

const COMPACT = "@media (max-width: 639px)";

const history = [
  {
    date: "1816",
    description:
      "John Johnston took a licence for the bay at Lagavulin, where illicit stills were already operating.",
    state: "operating",
    title: "Licensed",
  },
  {
    date: "1837",
    description:
      "The two distilleries in the bay were combined under one roof.",
    state: "operating",
  },
  {
    date: "1867",
    description:
      "The house that would become White Horse took on the distillery.",
    state: "operating",
    title: "Acquired by James Logan Mackie & Co",
  },
  {
    date: "1924",
    state: "operating",
    title: "Acquired by Distillers Company",
  },
  {
    date: "1962",
    description:
      "The Malt Mill stills, worked alongside Lagavulin since 1908, were dismantled.",
    state: "operating",
  },
  {
    date: "Dec 1997",
    description:
      "Diageo was formed from the merger of Guinness and Grand Metropolitan.",
    state: "operating",
    title: "Acquired by Diageo",
  },
  {
    date: "May 2016",
    description:
      "A third pair of stills was installed and the mash house rebuilt.",
    state: "operating",
  },
] as const;

/** A realistic entity composition for reviewing distillery-owned components. */
export function DistilleryPagePattern() {
  return (
    <main {...stylex.props(styles.page)}>
      <section {...stylex.props(styles.hero)}>
        <IdStamp detail="Distillery · operating" id="D01124" />
        <div {...stylex.props(styles.heroContent)}>
          <div {...stylex.props(styles.identity)}>
            <span {...stylex.props(foundationStyles.metadata, styles.eyebrow)}>
              Diageo · Islay
            </span>
            <h1 {...stylex.props(foundationStyles.pageTitle)}>Lagavulin</h1>
            <p {...stylex.props(foundationStyles.body, styles.description)}>
              Founded on the south shore of Islay beside Dunyvaig Castle.
              Lagavulin is known for long fermentation and a deeply peated house
              style.
            </p>
            <div {...stylex.props(styles.actions)}>
              <Button variant="accent">Follow</Button>
              <Button variant="tonal">Record a bottling</Button>
            </div>
          </div>
        </div>
      </section>
      <SpecStrip
        cells={[
          { label: "Founded", value: 1816 },
          { label: "Stills", value: 6 },
          { label: "Capacity", value: "2.5m L" },
          { label: "Bottlings", value: 312 },
        ]}
      />
      <section {...stylex.props(styles.historySection)}>
        <SectionHeading count={history.length}>History</SectionHeading>
        <HistoryTimeline
          events={history}
          summary="in production since 1816 · never silent · 7 recorded items, oldest first"
        />
      </section>
    </main>
  );
}

const styles = stylex.create({
  page: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "960px",
  },
  hero: {
    padding: { default: space.x6, [COMPACT]: space.x4 },
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  heroContent: {
    display: "flex",
    marginTop: space.x3,
  },
  identity: {
    minWidth: 0,
  },
  eyebrow: {
    color: colors.inkMuted,
  },
  description: {
    maxWidth: "620px",
    marginTop: space.x3,
    color: colors.inkMuted,
  },
  actions: {
    display: "flex",
    columnGap: space.x2,
    rowGap: space.x2,
    marginTop: space.x4,
    flexWrap: "wrap",
  },
  historySection: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x2,
    marginTop: space.x6,
  },
});
