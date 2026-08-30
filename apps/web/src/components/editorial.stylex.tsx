import * as stylex from "@stylexjs/stylex";
import type { MouseEvent, ReactNode } from "react";

import { colors, effects, fonts, space } from "../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { Avatar } from "./avatar.stylex";
import { BandMark, RATING_BANDS, type RatingBand } from "./scoring.stylex";
import { TextLink } from "./textLink.stylex";

const COMPACT = "@media (max-width: 639px)";

export type RecordMastheadProps = {
  aside?: ReactNode;
  detail: ReactNode;
  name: ReactNode;
  prefix?: ReactNode;
  status?: ReactNode;
};

/** Opens an editorial record with its classification, name, and member state. */
export function RecordMasthead({
  aside,
  detail,
  name,
  prefix,
  status,
}: RecordMastheadProps) {
  return (
    <div>
      <div {...stylex.props(styles.masthead)}>
        <span {...stylex.props(styles.detail)}>{detail}</span>
        {status ? <span {...stylex.props(styles.status)}>{status}</span> : null}
      </div>
      <div {...stylex.props(styles.titleRow)}>
        <h1 {...stylex.props(styles.title)}>
          {prefix ? (
            <span {...stylex.props(styles.titlePrefix)}>{prefix} </span>
          ) : null}
          {name}
        </h1>
        {aside ? <div {...stylex.props(styles.titleAside)}>{aside}</div> : null}
      </div>
    </div>
  );
}

export type RecordFigure = {
  label: ReactNode;
  scale?: "figure" | "word";
  tone?: "accent" | "default" | "muted";
  value?: ReactNode;
  wide?: boolean;
};

export type FigureRowProps = { figures?: readonly RecordFigure[] };

/** Shows two to four headline facts without placing them in panels. */
export function FigureRow({ figures = [] }: FigureRowProps) {
  const columns = figures
    .map((figure) => (figure.wide ? "minmax(0, 1.4fr)" : "minmax(0, 1fr)"))
    .join(" ");

  return (
    <div {...stylex.props(styles.figures, styles.figureColumns(columns))}>
      {figures.map((figure, index) => {
        const absent = figure.value === null || figure.value === undefined;
        return (
          <div key={index} {...stylex.props(styles.figure)}>
            <div
              {...stylex.props(
                styles.figureValue,
                figure.scale === "word" && styles.figureWord,
                figure.tone === "accent" && styles.accent,
                (figure.tone === "muted" || absent) && styles.muted,
              )}
            >
              {absent ? "–" : figure.value}
            </div>
            <div {...stylex.props(styles.figureLabel)}>{figure.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export type RecordTabItem = { count?: number; href: string; label: string };
export type RecordTabsProps = {
  ariaLabel: string;
  currentHref: string;
  items?: readonly RecordTabItem[];
  onSelect?: (href: string) => void;
};

/** Navigates peer sections of one record with an ink underline. */
export function RecordTabs({
  ariaLabel,
  currentHref,
  items = [],
  onSelect,
}: RecordTabsProps) {
  function handleSelect(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!onSelect) return;
    event.preventDefault();
    onSelect(href);
  }

  return (
    <nav aria-label={ariaLabel} {...stylex.props(styles.tabs)}>
      {items.map((item) => {
        const current = item.href === currentHref;
        return (
          <AppLink
            aria-current={current ? "page" : undefined}
            href={item.href}
            key={item.href}
            onClick={(event) => handleSelect(event, item.href)}
            {...stylex.props(styles.tab, current && styles.currentTab)}
          >
            {item.label}
            {item.count === undefined ? null : (
              <span {...stylex.props(styles.tabCount)}>
                {item.count.toLocaleString("en-US")}
              </span>
            )}
          </AppLink>
        );
      })}
    </nav>
  );
}

export type RecordSectionProps = {
  action?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
  title?: ReactNode;
};

export function RecordSection({
  action,
  aside,
  children,
  id,
  title,
}: RecordSectionProps) {
  return (
    <section id={id} {...stylex.props(styles.section)}>
      {title || aside ? (
        <div {...stylex.props(styles.sectionHead)}>
          {title ? (
            <h2 {...stylex.props(styles.sectionTitle)}>{title}</h2>
          ) : (
            <span />
          )}
          {aside ? (
            <span {...stylex.props(styles.sectionAside)}>{aside}</span>
          ) : null}
        </div>
      ) : null}
      {children}
      {action ? (
        <div {...stylex.props(styles.sectionAction)}>{action}</div>
      ) : null}
    </section>
  );
}

export type RecordFact = { label: ReactNode; value?: ReactNode };
export type FactGridProps = { facts?: readonly RecordFact[] };

export function FactGrid({ facts = [] }: FactGridProps) {
  return (
    <div {...stylex.props(styles.facts)}>
      {facts.map((fact, index) => {
        const absent = fact.value === null || fact.value === undefined;
        return (
          <div key={index}>
            <div {...stylex.props(styles.factLabel)}>{fact.label}</div>
            <div {...stylex.props(styles.factValue, absent && styles.muted)}>
              {absent ? "–" : fact.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type ReviewQuoteProps = {
  href?: string;
  publication: string;
  publishedAt?: string;
  quote: string;
  rating?: number | null;
  reviewerName?: string;
};

/** Keeps a critic's quote and native 100-point score together. */
export function ReviewQuote({
  href,
  publication,
  publishedAt,
  quote,
  rating,
  reviewerName,
}: ReviewQuoteProps) {
  const hasRating = rating !== null && rating !== undefined;
  return (
    <article {...stylex.props(styles.entry)}>
      <div {...stylex.props(styles.measure)}>
        <div {...stylex.props(styles.score, !hasRating && styles.muted)}>
          {hasRating ? rating : "–"}
        </div>
        <div {...stylex.props(styles.scoreUnit)}>
          {hasRating ? "of 100" : "own scale"}
        </div>
      </div>
      <div {...stylex.props(styles.entryCopy)}>
        <p {...stylex.props(styles.quote)}>“{quote}”</p>
        <div {...stylex.props(styles.byline)}>
          {reviewerName ? <span>{reviewerName}</span> : null}
          {href ? (
            <TextLink href={href} size="inherit">
              {publication}
            </TextLink>
          ) : (
            <span>{publication}</span>
          )}
          {publishedAt ? <span>{publishedAt}</span> : null}
        </div>
      </div>
    </article>
  );
}

export type TastingNoteProps = {
  author: string;
  authorHref?: string;
  band: RatingBand;
  context?: string;
  initials: string;
  note?: string;
};

export function TastingNote({
  author,
  authorHref,
  band,
  context,
  initials,
  note,
}: TastingNoteProps) {
  const selectedBand = RATING_BANDS.find((candidate) => candidate.key === band);
  return (
    <article {...stylex.props(styles.entry, styles.tastingEntry)}>
      <div {...stylex.props(styles.measure)}>
        <div {...stylex.props(styles.bandName)}>
          {selectedBand?.label ?? "–"}
        </div>
        <div {...stylex.props(styles.bandSlot)}>
          <BandMark band={band} />
        </div>
      </div>
      <div {...stylex.props(styles.entryCopy)}>
        <p {...stylex.props(styles.note, !note && styles.muted)}>
          {note || "No notes."}
        </p>
        <div {...stylex.props(styles.byline)}>
          <Avatar initials={initials} size="xs" />
          {authorHref ? (
            <TextLink href={authorHref} size="inherit">
              {author}
            </TextLink>
          ) : (
            <span {...stylex.props(styles.author)}>{author}</span>
          )}
          {context ? <span>{context}</span> : null}
        </div>
      </div>
    </article>
  );
}

export type RailSectionProps = {
  children: ReactNode;
  intro?: ReactNode;
  title: ReactNode;
};

export function RailSection({ children, intro, title }: RailSectionProps) {
  return (
    <section>
      <h2 {...stylex.props(styles.railTitle)}>{title}</h2>
      {intro ? <p {...stylex.props(styles.railIntro)}>{intro}</p> : null}
      {children}
    </section>
  );
}

export type RailLinkItem = {
  end?: ReactNode;
  endAbsent?: boolean;
  endFormat?: "data" | "text";
  href?: string;
  metadata?: ReactNode;
  name: ReactNode;
};

export type RailLinkListProps = {
  ariaLabel: string;
  items?: readonly RailLinkItem[];
};

export function RailLinkList({ ariaLabel, items = [] }: RailLinkListProps) {
  return (
    <ul aria-label={ariaLabel} {...stylex.props(styles.railList)}>
      {items.map((item, index) => {
        const content = (
          <>
            <span {...stylex.props(styles.railCopy)}>
              <span {...stylex.props(styles.railName)}>{item.name}</span>
              {item.metadata ? (
                <span {...stylex.props(styles.railMetadata)}>
                  {item.metadata}
                </span>
              ) : null}
            </span>
            {item.end ? (
              <span
                {...stylex.props(
                  styles.railEnd,
                  item.endFormat === "data" && styles.railEndData,
                  item.endAbsent && styles.muted,
                )}
              >
                {item.end}
              </span>
            ) : null}
          </>
        );
        return (
          <li key={index} {...stylex.props(styles.railItem)}>
            {item.href ? (
              <AppLink
                href={item.href}
                {...stylex.props(styles.railRow, styles.railLink)}
              >
                {content}
              </AppLink>
            ) : (
              <div {...stylex.props(styles.railRow)}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export type RecordPrompt = { label: ReactNode; value: ReactNode };
export type ThinRecordPromptProps = {
  actions?: ReactNode;
  children: ReactNode;
  heading: ReactNode;
  prompts?: readonly RecordPrompt[];
};

export function ThinRecordPrompt({
  actions,
  children,
  heading,
  prompts = [],
}: ThinRecordPromptProps) {
  return (
    <section {...stylex.props(styles.thinRecord)}>
      <h2 {...stylex.props(styles.emptyHeading)}>{heading}</h2>
      <div {...stylex.props(styles.emptyBody)}>{children}</div>
      {actions ? (
        <div {...stylex.props(styles.emptyActions)}>{actions}</div>
      ) : null}
      {prompts.length ? (
        <div {...stylex.props(styles.prompts)}>
          {prompts.map((prompt, index) => (
            <div key={index}>
              <div {...stylex.props(styles.promptValue)}>{prompt.value}</div>
              <div {...stylex.props(styles.promptLabel)}>{prompt.label}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

const styles = stylex.create({
  masthead: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x6,
    paddingTop: "28px",
    flexWrap: "wrap",
  },
  detail: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
  },
  status: {
    color: colors.accentDeep,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.3,
  },
  titleRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: space.x6,
    paddingTop: "2px",
    paddingBottom: "18px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
  },
  title: {
    minWidth: 0,
    flex: 1,
    margin: 0,
    fontFamily: fonts.display,
    fontSize: "clamp(40px, 5vw, 72px)",
    fontWeight: 700,
    letterSpacing: "-0.05em",
    lineHeight: 0.95,
    textWrap: "balance",
  },
  titlePrefix: { color: colors.ink },
  titleAside: {
    display: "flex",
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "flex-end",
  },
  figures: {
    display: "grid",
    alignItems: "start",
    paddingTop: "20px",
    paddingBottom: "22px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    [COMPACT]: {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      rowGap: "20px",
    },
  },
  figureColumns: (columns: string) => ({ gridTemplateColumns: columns }),
  figure: {
    minWidth: 0,
    paddingRight: space.x6,
    paddingLeft: space.x6,
    borderLeftWidth: "1px",
    borderLeftStyle: "solid",
    borderLeftColor: colors.hairline,
    ":first-child": { paddingLeft: 0, borderLeftWidth: 0 },
    ":last-child": { paddingRight: 0 },
    [COMPACT]: { ":nth-child(odd)": { paddingLeft: 0, borderLeftWidth: 0 } },
  },
  figureValue: {
    overflowWrap: "break-word",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "40px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.045em",
    lineHeight: 0.9,
  },
  figureWord: {
    paddingTop: "6px",
    fontSize: "26px",
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
  },
  figureLabel: {
    marginTop: "6px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
  },
  accent: { color: colors.accent },
  muted: { color: colors.inkMuted },
  tabs: {
    display: "flex",
    gap: space.x6,
    marginTop: "28px",
    paddingBottom: "2px",
    overflowX: "auto",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    scrollbarWidth: "none",
  },
  tab: {
    flexShrink: 0,
    paddingTop: space.x2,
    paddingBottom: space.x2,
    color: { default: colors.inkMuted, ":hover": colors.ink },
    fontFamily: fonts.reading,
    fontSize: "15px",
    fontWeight: 600,
    lineHeight: 1.3,
    textDecoration: "none",
    whiteSpace: "nowrap",
    outline: "none",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
  currentTab: {
    borderBottomWidth: "2px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.ink,
    color: colors.ink,
    fontFamily: fonts.display,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  tabCount: {
    marginLeft: "6px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "13px",
    fontVariantNumeric: "tabular-nums",
  },
  section: {
    paddingTop: space.x8,
    paddingBottom: space.x8,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  sectionHead: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x4,
    marginBottom: space.x4,
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontFamily: fonts.display,
    fontSize: "20px",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    lineHeight: 1.2,
  },
  sectionAside: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
  },
  sectionAction: { marginTop: "22px" },
  facts: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: `22px ${space.x8}`,
  },
  factLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
  },
  factValue: {
    marginTop: space.x1,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "17px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.3,
  },
  entry: {
    display: "grid",
    gridTemplateColumns: "88px minmax(0, 1fr)",
    gap: "20px",
    alignItems: "start",
  },
  tastingEntry: {
    gridTemplateColumns: "116px minmax(0, 1fr)",
    gap: space.x6,
    paddingTop: "18px",
    paddingBottom: "18px",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
  measure: { textAlign: "right" },
  score: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "40px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.045em",
    lineHeight: 0.9,
  },
  scoreUnit: {
    marginTop: "5px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
  },
  entryCopy: { minWidth: 0 },
  quote: {
    maxWidth: "54ch",
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "19px",
    fontWeight: 400,
    letterSpacing: "-0.015em",
    lineHeight: 1.4,
    textWrap: "pretty",
  },
  byline: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    marginTop: "10px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
    flexWrap: "wrap",
  },
  author: { fontWeight: 600 },
  bandName: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  bandSlot: { display: "flex", justifyContent: "flex-end", marginTop: "6px" },
  note: {
    maxWidth: "58ch",
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.6,
    textWrap: "pretty",
  },
  railTitle: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "16px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
  },
  railIntro: {
    maxWidth: "32ch",
    marginTop: "6px",
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  railList: {
    marginTop: space.x3,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    padding: 0,
    listStyle: "none",
  },
  railItem: {
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    ":last-child": { borderBottomWidth: 0 },
  },
  railRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x3,
    marginRight: "-8px",
    marginLeft: "-8px",
    paddingTop: "9px",
    paddingRight: space.x2,
    paddingBottom: "9px",
    paddingLeft: space.x2,
    color: colors.ink,
    textDecoration: "none",
  },
  railLink: {
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":active": colors.inset,
    },
    outline: "none",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
  railCopy: { minWidth: 0 },
  railName: {
    display: "block",
    minWidth: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
  },
  railMetadata: {
    display: "block",
    marginTop: "3px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
  },
  railEnd: {
    flexShrink: 0,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.35,
  },
  railEndData: {
    fontFamily: fonts.data,
    fontSize: "14px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.3,
  },
  thinRecord: {
    paddingTop: space.x2,
    paddingBottom: space.x8,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  emptyHeading: {
    maxWidth: "32ch",
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "30px",
    fontWeight: 700,
    letterSpacing: "-0.032em",
    lineHeight: 1.1,
    textWrap: "balance",
  },
  emptyBody: {
    maxWidth: "52ch",
    marginTop: space.x3,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.6,
    textWrap: "pretty",
  },
  emptyActions: {
    display: "flex",
    gap: space.x2,
    marginTop: "20px",
    flexWrap: "wrap",
  },
  prompts: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
    gap: space.x6,
    marginTop: space.x8,
    paddingTop: space.x6,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
  promptValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "22px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
  },
  promptLabel: {
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
});
