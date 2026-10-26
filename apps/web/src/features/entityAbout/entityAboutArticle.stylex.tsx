import type { EntityKind } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";

import { SectionHeading } from "../../components/sectionHeading.stylex";
import { TextLink } from "../../components/textLink.stylex";
import { getEntityUrl } from "../../lib/urls";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
import {
  ABOUT_MIN_BOTTLERS,
  ABOUT_MIN_RELEASE_BOTTLES,
  ABOUT_MIN_TIMELINE_SPANS,
  ABOUT_MIN_VINTAGE_BOTTLES,
  countWithYear,
  fillYears,
  getEras,
  getNameSpans,
  getOperatingSpans,
  linkEntityMentions,
  type AboutEvent,
  type AboutSection,
  type EntityAbout,
  type RelatedCounts,
  type YearCounts,
} from "./entityAbout";
import { EntityLifeline } from "./entityLifeline.stylex";
import { RelatedEntityList } from "./relatedEntityList.stylex";
import { VintageChart } from "./vintageChart.stylex";

export type EntityAboutCounts = {
  vintages: YearCounts;
  bottlers: RelatedCounts;
  distillers: RelatedCounts;
  releaseYears: YearCounts;
};

export type EntityAboutArticleProps = {
  about: EntityAbout;
  entity: { id: number; name: string; kind: EntityKind };
  counts: EntityAboutCounts;
  citationNumbers: Map<string, number>;
  currentYear: number;
};

const reviewedFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const DISAGREEMENT_TOPICS = {
  acquired: "when the owner changed",
  closed: "when it closed",
  era: "when this period ran",
  generic: "the date",
  mothballed: "when it was mothballed",
  opened: "when it opened",
  renamed: "when the name changed",
  reopened: "when it reopened",
} satisfies Record<AboutEvent["kind"], string>;

export function Citations({
  ids,
  numbers,
}: {
  ids: readonly string[];
  numbers: Map<string, number>;
}) {
  const cited = [...new Set(ids)]
    .flatMap((id) => {
      const number = numbers.get(id);
      return number ? [{ id, number }] : [];
    })
    .sort((a, b) => a.number - b.number);
  if (!cited.length) return null;

  return (
    <sup {...stylex.props(styles.citations)}>
      {cited.map((entry, index) => (
        <span key={entry.id}>
          {index > 0 ? "," : null}
          <a
            aria-label={`Source ${entry.number}`}
            href={`#source-${entry.id}`}
            {...stylex.props(styles.citation)}
          >
            {entry.number}
          </a>
        </span>
      ))}
    </sup>
  );
}

/** Names each value sources give, with their citations, and the one shown. */
function Disagreement({
  event,
  about,
  numbers,
}: {
  event: AboutEvent;
  about: EntityAbout;
  numbers: Map<string, number>;
}) {
  if (!event.disagreement) return null;
  return (
    <aside {...stylex.props(styles.disagreement)}>
      <p {...stylex.props(foundationStyles.fieldLabel, styles.noteLabel)}>
        Sources disagree: {DISAGREEMENT_TOPICS[event.kind]}
      </p>
      <ul {...stylex.props(styles.disagreementList)}>
        {event.disagreement.values.map((entry) => (
          <li
            key={entry.value}
            {...stylex.props(foundationStyles.body, styles.muted)}
          >
            {entry.value}:{" "}
            {entry.sourceIds
              .flatMap((id) => {
                const source = about.sources.find((item) => item.id === id);
                return source ? [source.publisher ?? source.title] : [];
              })
              .join(", ")}
            <Citations ids={entry.sourceIds} numbers={numbers} />
          </li>
        ))}
      </ul>
      <p {...stylex.props(foundationStyles.metadata, styles.muted)}>
        This page uses {event.date.slice(0, 4)}.
      </p>
    </aside>
  );
}

function ArticleSection({
  section,
  about,
  numbers,
}: {
  section: AboutSection;
  about: EntityAbout;
  numbers: Map<string, number>;
}) {
  const citedFactIds = new Set(
    section.sentences.flatMap((sentence) => sentence.factIds),
  );
  const disputed = about.events.filter(
    (event) => event.disagreement && citedFactIds.has(`event:${event.id}`),
  );
  const era = section.eraEventId
    ? about.events.find((event) => event.id === section.eraEventId)
    : undefined;
  const id = `about-${section.key}`;

  return (
    <section aria-labelledby={id} {...stylex.props(styles.section)}>
      <div {...stylex.props(styles.sectionHeader)}>
        <SectionHeading id={id}>{section.heading}</SectionHeading>
        {era ? (
          <span {...stylex.props(foundationStyles.metadata, styles.muted)}>
            {era.date.slice(0, 4)}–
            {era.endDate ? era.endDate.slice(0, 4) : "today"}
          </span>
        ) : null}
      </div>
      <p {...stylex.props(foundationStyles.prose)}>
        <Sentences about={about} numbers={numbers} section={section} />
      </p>
      {disputed.map((event) => (
        <Disagreement
          about={about}
          event={event}
          key={event.id}
          numbers={numbers}
        />
      ))}
    </section>
  );
}

function RelatedList({
  heading,
  intro,
  counts,
  title,
  noun,
}: {
  heading: string;
  intro: string;
  counts: RelatedCounts;
  title: string;
  noun: string;
}) {
  return (
    <section
      aria-label={heading}
      {...stylex.props(styles.section, styles.chartSection)}
    >
      <SectionHeading>{heading}</SectionHeading>
      <p {...stylex.props(foundationStyles.body, styles.muted)}>{intro}</p>
      <RelatedEntityList counts={counts} noun={noun} title={title} />
    </section>
  );
}

function YearChart({
  heading,
  intro,
  counts,
  about,
  entityName,
  bottleListHref,
}: {
  heading: string;
  intro: string;
  counts: YearCounts;
  about: EntityAbout;
  entityName: string;
  bottleListHref?: string;
}) {
  return (
    <section
      aria-label={heading}
      {...stylex.props(styles.section, styles.chartSection)}
    >
      <SectionHeading>{heading}</SectionHeading>
      <p {...stylex.props(foundationStyles.body, styles.muted)}>{intro}</p>
      <VintageChart
        eras={getEras(about)}
        bottleListHref={bottleListHref}
        names={getNameSpans(about, entityName)}
        withoutYear={counts.withoutYear}
        years={fillYears(counts)}
      />
    </section>
  );
}

/**
 * The About page body. Its template is fixed per Entity kind (owner:
 * docs/features/entity-about.md); each part shows only above its minimum.
 */
export function EntityAboutArticle({
  about,
  entity,
  counts,
  citationNumbers,
  currentYear,
}: EntityAboutArticleProps) {
  const lanes = [
    {
      label: "Status",
      spans: getOperatingSpans(about),
      quietLabel: "Silent",
    },
    {
      label: "Name",
      spans: getNameSpans(about, entity.name),
      tone: "neutral" as const,
    },
  ].filter((lane) => lane.spans.length);
  const showTimeline =
    lanes.reduce((total, lane) => total + lane.spans.length, 0) >=
    ABOUT_MIN_TIMELINE_SPANS;
  const showVintages =
    entity.kind === "distillery" &&
    countWithYear(counts.vintages) >= ABOUT_MIN_VINTAGE_BOTTLES;
  const showBottlers =
    entity.kind === "distillery" &&
    counts.bottlers.results.length >= ABOUT_MIN_BOTTLERS;
  const showDistillers =
    (entity.kind === "brand" || entity.kind === "bottler") &&
    counts.distillers.results.length > 0;
  const showReleaseYears =
    countWithYear(counts.releaseYears) >= ABOUT_MIN_RELEASE_BOTTLES;
  const sources = about.sources
    .filter((source) => citationNumbers.has(source.id))
    .sort(
      (a, b) =>
        (citationNumbers.get(a.id) ?? 0) - (citationNumbers.get(b.id) ?? 0),
    );

  return (
    <article {...stylex.props(styles.article)}>
      {showTimeline ? (
        <section aria-label="Timeline" {...stylex.props(styles.timeline)}>
          <EntityLifeline currentYear={currentYear} lanes={lanes} />
        </section>
      ) : null}

      {about.sections.map((section) => (
        <ArticleSection
          about={about}
          key={section.key}
          numbers={citationNumbers}
          section={section}
        />
      ))}

      {showVintages ? (
        <YearChart
          about={about}
          counts={counts.vintages}
          entityName={entity.name}
          heading="Bottles by year distilled"
          bottleListHref={`/bottles?distiller=${entity.id}`}
          intro="Every bottle in Peated with a vintage year."
        />
      ) : null}

      {showBottlers ? (
        <RelatedList
          counts={counts.bottlers}
          heading="Who bottled it"
          noun="bottlers"
          title={`Who bottled ${entity.name}`}
          intro={`Bottles in Peated distilled at ${entity.name}, by bottler.`}
        />
      ) : null}

      {showDistillers ? (
        <RelatedList
          counts={counts.distillers}
          heading="Where it's made"
          noun="distilleries"
          title={`Where ${entity.name} is made`}
          intro={
            entity.kind === "bottler"
              ? `Bottles in Peated bottled by ${entity.name}, by distillery.`
              : `Bottles in Peated sold as ${entity.name}, by distillery.`
          }
        />
      ) : null}

      {showReleaseYears ? (
        <YearChart
          about={about}
          counts={counts.releaseYears}
          entityName={entity.name}
          heading="Releases by year"
          intro={
            entity.kind === "distillery"
              ? `Bottles in Peated distilled at ${entity.name}, by release year.`
              : entity.kind === "bottler"
                ? `Bottles in Peated bottled by ${entity.name}, by release year.`
                : `Bottles in Peated sold as ${entity.name}, by release year.`
          }
        />
      ) : null}

      <section
        aria-labelledby="about-sources"
        {...stylex.props(styles.section)}
      >
        <SectionHeading id="about-sources">Sources</SectionHeading>
        <ol {...stylex.props(styles.sources)}>
          {sources.map((source) => (
            <li
              id={`source-${source.id}`}
              key={source.id}
              {...stylex.props(styles.source)}
            >
              <span
                {...stylex.props(
                  foundationStyles.metadata,
                  styles.sourceNumber,
                )}
              >
                {citationNumbers.get(source.id)}
              </span>
              <span {...stylex.props(styles.sourceText)}>
                <TextLink href={source.url} rel="noreferrer" target="_blank">
                  {source.title}
                </TextLink>
                {source.publisher ? (
                  <span
                    {...stylex.props(foundationStyles.metadata, styles.muted)}
                  >
                    {source.publisher}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
        {about.checkedOn ? (
          <p {...stylex.props(foundationStyles.metadata, styles.muted)}>
            Checked against these sources on{" "}
            {reviewedFormatter.format(new Date(`${about.checkedOn}T00:00:00Z`))}
            . Something wrong? Report it from the menu at the top of the page.
          </p>
        ) : null}
      </section>
    </article>
  );
}

/** The opening paragraph, placed by the page above its sidebar. */
export function EntityAboutLead({
  about,
  lead,
  citationNumbers,
}: {
  about: EntityAbout;
  lead: AboutSection;
  citationNumbers: Map<string, number>;
}) {
  return (
    <p {...stylex.props(foundationStyles.prose, styles.lead)}>
      <Sentences about={about} numbers={citationNumbers} section={lead} />
    </p>
  );
}

/** A section's sentences, with linked Entity names and source numbers. */
function Sentences({
  section,
  about,
  numbers,
}: {
  section: AboutSection;
  about: EntityAbout;
  numbers: Map<string, number>;
}) {
  const parts = linkEntityMentions(section, about);
  return section.sentences.map((sentence, index) => (
    <span key={`${index}-${sentence.text}`}>
      {index > 0 ? " " : null}
      {parts[index]!.map((part, partIndex) =>
        part.entity ? (
          <TextLink href={getEntityUrl(part.entity)} key={partIndex}>
            {part.text}
          </TextLink>
        ) : (
          part.text
        ),
      )}
      <Citations ids={sentence.sourceIds} numbers={numbers} />
    </span>
  ));
}

const styles = stylex.create({
  article: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    maxWidth: "70ch",
  },
  lead: {
    maxWidth: "62ch",
    fontSize: "18px",
    lineHeight: 1.6,
  },
  timeline: {
    paddingTop: space.x2,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: space.x3,
    paddingTop: space.x8,
  },
  chartSection: {
    maxWidth: "100%",
  },
  sectionHeader: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: space.x3,
  },
  muted: {
    margin: 0,
    color: colors.inkMuted,
  },
  citations: {
    marginLeft: "2px",
    fontSize: "11px",
    lineHeight: 0,
    fontVariantNumeric: "tabular-nums",
  },
  citation: {
    color: colors.accent,
    textDecoration: { default: "none", ":hover": "underline" },
    paddingInline: "1px",
  },
  noteLabel: {
    margin: 0,
  },
  disagreement: {
    display: "flex",
    flexDirection: "column",
    gap: space.x1,
    padding: space.x3,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.sectionRule,
    borderRadius: "4px",
  },
  disagreementList: {
    margin: 0,
    paddingLeft: space.x4,
  },
  sources: {
    display: "flex",
    flexDirection: "column",
    gap: space.x2,
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  // A footnote link targets its source, which is highlighted on arrival.
  source: {
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr)",
    alignItems: "baseline",
    scrollMarginTop: "24px",
    marginInline: `calc(-1 * ${space.x2})`,
    paddingBlock: space.x1,
    paddingInline: space.x2,
    borderRadius: "3px",
    backgroundColor: { default: "transparent", ":target": colors.inset },
  },
  sourceNumber: {
    color: { default: colors.inkMuted, ":is(:target > *)": colors.accent },
  },
  sourceText: {
    display: "flex",
    flexDirection: "column",
  },
});
