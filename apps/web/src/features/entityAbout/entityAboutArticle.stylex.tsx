import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { SectionHeading } from "../../components/sectionHeading.stylex";
import { TextLink } from "../../components/textLink.stylex";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
import {
  getCitationNumbers,
  type AboutDisagreement,
  type AboutSection,
  type EntityAbout,
  type VintageCount,
} from "./entityAbout";
import { EntityLifeline } from "./entityLifeline.stylex";
import { VintageChart } from "./vintageChart.stylex";

export type EntityAboutArticleProps = {
  about: EntityAbout;
  currentYear: number;
  vintages: { years: readonly VintageCount[]; withoutVintage: number };
};

const reviewedFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function Citations({
  ids,
  numbers,
}: {
  ids: readonly string[];
  numbers: Map<string, number>;
}) {
  const cited = [...new Set(ids)]
    .map((id) => ({ id, number: numbers.get(id) }))
    .filter((entry): entry is { id: string; number: number } =>
      Boolean(entry.number),
    )
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

function Disagreement({
  note,
  numbers,
}: {
  note: AboutDisagreement;
  numbers: Map<string, number>;
}) {
  return (
    <aside {...stylex.props(styles.disagreement)}>
      <p {...stylex.props(foundationStyles.fieldLabel, styles.noteLabel)}>
        Sources disagree: {note.topic.toLowerCase()}
      </p>
      <p {...stylex.props(foundationStyles.body, styles.muted)}>
        {note.text}
        <Citations ids={note.sources} numbers={numbers} />
      </p>
    </aside>
  );
}

function ArticleSection({
  section,
  numbers,
  level,
  after,
}: {
  section: AboutSection;
  numbers: Map<string, number>;
  level: 2 | 3;
  after?: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`about-${section.id}`}
      {...stylex.props(level === 2 ? styles.section : styles.subsection)}
    >
      <div {...stylex.props(styles.sectionHeader)}>
        {level === 2 ? (
          <SectionHeading id={`about-${section.id}`}>
            {section.heading}
          </SectionHeading>
        ) : (
          <h3
            id={`about-${section.id}`}
            {...stylex.props(foundationStyles.rowTitle, styles.subheading)}
          >
            {section.heading}
          </h3>
        )}
        {section.years ? (
          <span {...stylex.props(foundationStyles.metadata, styles.muted)}>
            {section.years}
          </span>
        ) : null}
      </div>
      {section.paragraphs.map((paragraph) => (
        <p
          key={paragraph.text}
          {...stylex.props(foundationStyles.prose, styles.paragraph)}
        >
          {paragraph.text}
          <Citations ids={paragraph.sources} numbers={numbers} />
        </p>
      ))}
      {section.disagreements?.map((note) => (
        <Disagreement key={note.topic} note={note} numbers={numbers} />
      ))}
      {section.subsections?.map((subsection) => (
        <ArticleSection
          key={subsection.id}
          level={3}
          numbers={numbers}
          section={subsection}
        />
      ))}
      {after}
    </section>
  );
}

/** The article's opening paragraph, placed by the page above its sidebar. */
export function EntityAboutLead({ about }: { about: EntityAbout }) {
  return (
    <p {...stylex.props(foundationStyles.prose, styles.lead)}>
      {about.lead.text}
      <Citations ids={about.lead.sources} numbers={getCitationNumbers(about)} />
    </p>
  );
}

/**
 * Reads like a short reference article: the site's life on one year axis, sourced sections, live catalog data, and numbered sources.
 */
export function EntityAboutArticle({
  about,
  currentYear,
  vintages,
}: EntityAboutArticleProps) {
  const numbers = getCitationNumbers(about);
  const sources = [...about.sources]
    .filter((source) => numbers.has(source.id))
    .sort((a, b) => numbers.get(a.id)! - numbers.get(b.id)!);
  const [nameSection, historySection, ...laterSections] = about.sections;

  return (
    <article {...stylex.props(styles.article)}>
      <section aria-label="Timeline" {...stylex.props(styles.timeline)}>
        <EntityLifeline
          currentYear={currentYear}
          lanes={[
            { label: "Status", spans: about.operating, quietLabel: "Silent" },
            { label: "Name", spans: about.names, tone: "neutral" },
          ]}
        />
      </section>

      {nameSection ? (
        <ArticleSection level={2} numbers={numbers} section={nameSection} />
      ) : null}
      {historySection ? (
        <ArticleSection level={2} numbers={numbers} section={historySection} />
      ) : null}

      {vintages.years.length ? (
        <section
          aria-labelledby="about-vintages"
          {...stylex.props(styles.section)}
        >
          <SectionHeading id="about-vintages">
            Bottles by year distilled
          </SectionHeading>
          <p {...stylex.props(foundationStyles.body, styles.muted)}>
            Every bottle in Peated with a vintage year.
          </p>
          <VintageChart
            highlight={about.peatedYears}
            names={about.names}
            withoutVintage={vintages.withoutVintage}
            years={vintages.years}
          />
        </section>
      ) : null}

      {laterSections.map((section) => (
        <ArticleSection
          key={section.id}
          level={2}
          numbers={numbers}
          section={section}
        />
      ))}

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
              <span {...stylex.props(foundationStyles.metadata, styles.muted)}>
                {numbers.get(source.id)}
              </span>
              <span {...stylex.props(styles.sourceText)}>
                <TextLink href={source.url} rel="noreferrer" target="_blank">
                  {source.title}
                </TextLink>
                <span
                  {...stylex.props(foundationStyles.metadata, styles.muted)}
                >
                  {source.publisher}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p {...stylex.props(foundationStyles.metadata, styles.muted)}>
          Checked against these sources on{" "}
          {reviewedFormatter.format(new Date(`${about.reviewedOn}T00:00:00Z`))}.
          Something wrong? Report it from the menu at the top of the page.
        </p>
      </section>
    </article>
  );
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
  subsection: {
    display: "flex",
    flexDirection: "column",
    gap: space.x3,
    paddingTop: space.x6,
  },
  sectionHeader: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: space.x3,
  },
  subheading: {
    margin: 0,
    color: colors.ink,
  },
  paragraph: {
    color: colors.ink,
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
  sources: {
    display: "flex",
    flexDirection: "column",
    gap: space.x2,
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  source: {
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr)",
    alignItems: "baseline",
    scrollMarginTop: "24px",
  },
  sourceText: {
    display: "flex",
    flexDirection: "column",
  },
});
