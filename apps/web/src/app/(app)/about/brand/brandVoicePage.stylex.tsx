import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { PeatedId, SectionHeading } from "@peated/web/components";
import { foundationStyles } from "../../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../../../styles/tokens.stylex";

const NARROW = "@media (max-width: 759px)";
const MOBILE = "@media (max-width: 559px)";

type VoiceRule = {
  body: string;
  example: () => ReactNode;
  title: string;
  wide?: boolean;
};

const rules: readonly VoiceRule[] = [
  {
    title: "The joke is in the noun, never in the delivery",
    body: "Use understatement. Do not add exclamation marks, winks, or a nudge to make a line land. If the words are not enough, cut the joke.",
    example: () => (
      <>
        <strong>Unicorn · 95 and up</strong>
        <small>Names the tier and admits the tier is slightly absurd.</small>
      </>
    ),
  },
  {
    title: "Specificity is the humour",
    body: "Say the number. A precise fact is more useful and usually funnier than a vague claim. Vagueness is where copy goes to be cute.",
    example: () => (
      <>
        <s>Lots of ratings</s>
        <strong>2,841 people have an opinion about this</strong>
        <strong>You own 41 bottles. You have opened 6.</strong>
      </>
    ),
  },
  {
    title: "No jargon, including ours",
    body: "Use the words a drinker knows. Our internal terms are worse than trade jargon because we put them there. Product-marketing language says even less.",
    example: () => (
      <div {...stylex.props(styles.wordLists)}>
        <WordList
          label="Trade jargon"
          words="expression · liquid · NAS without expansion · organoleptic · the water of life"
        />
        <WordList
          accent
          label="Ours — the worst list"
          words="aggregate · entity · canonical · verdict · grain · band"
        />
        <WordList
          label="Product marketing"
          words="curated · discover · journey · unlock · seamless · experience · community-driven"
        />
      </div>
    ),
    wide: true,
  },
  {
    title: "Never flatter the whisky or the reader",
    body: "Describe what is recorded and let the reader decide. Reverence reads as pretension. Flattery reads as an app trying to be your friend.",
    example: () => (
      <>
        <s>beautifully crafted · liquid gold · a true classic</s>
        <s>great choice · you’re on a roll · nice palate</s>
      </>
    ),
  },
  {
    title: "Humour falls as frustration rises",
    body: "A first-run empty state can carry dry wit. A failed sign-in cannot. Never joke about the reader’s data, taste, or spending. Joke about the hobby or about us.",
    example: () => (
      <dl {...stylex.props(styles.registerList)}>
        <RegisterRow label="Empty states and first run" value="Driest wit" />
        <RegisterRow label="Labels and headings" value="Plain and specific" />
        <RegisterRow label="Forms in progress" value="Nothing clever" />
        <RegisterRow label="Errors, data loss, auth" value="Zero jokes" />
      </dl>
    ),
    wide: true,
  },
] as const;

const comparisons = [
  {
    before: "Discover your next favourite dram",
    after: "184,204 bottlings. Someone has probably logged yours.",
    reason: "“Discover” is marketing jargon. The number is the actual pitch.",
  },
  {
    before: "3 taps to log",
    after: "Cut it. Show the form.",
    reason: "It is a claim about us, not information for the reader.",
  },
  {
    before: "On the shelf · 41",
    after: "In your library · 41",
    reason: "We cannot see the shelf. Do not state what nobody can check.",
  },
  {
    before: "Your tasting journey starts here",
    after: "You haven’t logged anything yet. That’s fixable.",
    reason: "The second is dry, direct, and points toward the action.",
  },
  {
    before: "Oops! Something went wrong 🥃",
    after:
      "We couldn’t save that tasting. Your notes are still here — try again.",
    reason: "Errors do not joke. Say what failed and what survived.",
  },
  {
    before: "Curated picks from our community of enthusiasts",
    after: "What 2,841 people thought",
    reason: "No jargon. The number does the work.",
  },
  {
    before: "Level 7 of 50",
    after: "9 of 12 Islay distilleries",
    reason: "A level says nothing. The real count says everything.",
  },
  {
    before: "Nice palate! You agree with the critics 78% of the time",
    after: "Cut it.",
    reason: "It flatters the reader and turns their page into a scoreboard.",
  },
  {
    before: "No results found",
    after: "Nothing matches “ardbeeg”. Record it?",
    reason: "Keep the query visible and offer the useful next action.",
  },
] as const;

const mechanics = [
  {
    title: "Use “dram” sparingly",
    body: "It is vernacular, not jargon. Use it at most once per screen, never in a heading, and never as a cute plural.",
  },
  {
    title: "Use second person and contractions",
    body: "Write “You haven’t logged anything yet,” not “No tastings have been recorded.”",
  },
  {
    title: "Use numerals for counts",
    body: "Write “6 bottles” in labels, stats, scores, and ages. Running prose can spell a number when it reads better.",
  },
  {
    title: "Use sentence case",
    body: "Title Case reads like a brochure. Mono capitals are a visual device, not a voice.",
  },
  {
    title: "Invite the fix",
    body: "Write “We don’t have this one yet. Add it?” Do not apologise for an incomplete database.",
  },
  {
    title: "Do not name feelings",
    body: "We know what someone poured. We do not know how they felt beyond what they recorded.",
  },
] as const;

export function BrandVoicePage() {
  return (
    <article {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.hero)}>
        <PeatedId id="VOICE" detail="tone · copy · the words themselves" />
        <h1 {...stylex.props(foundationStyles.pageTitle, styles.title)}>
          Serious about the record.
          <br />
          Light about the drinking.
        </h1>
        <p {...stylex.props(styles.lede)}>
          The obvious way to sound relaxed is to dismiss whisky. The obvious way
          to sound credible is to revere it. Both are wrong. The database is not
          a joke. The hobby can be faintly ridiculous.
        </p>
        <div {...stylex.props(styles.positionGrid)}>
          <PositionCard label="Not a joke">
            Complete bottle records. Every cask. Corrections welcome. What a
            source said, in the scale it used.
          </PositionCard>
          <PositionCard accent label="Faintly ridiculous">
            Paying real money for a 1983. Owning 41 bottles and opening 6.
            Having an opinion about the gap between an 88 and an 89.
          </PositionCard>
        </div>
      </header>

      <VoiceSection heading="The 5 rules">
        <ol {...stylex.props(styles.ruleList)}>
          {rules.map((rule, index) => (
            <li
              key={rule.title}
              {...stylex.props(styles.ruleCard, rule.wide && styles.ruleWide)}
            >
              <div {...stylex.props(styles.ruleCopy)}>
                <h3 {...stylex.props(styles.cardTitle)}>
                  {index + 1} · {rule.title}
                </h3>
                <p {...stylex.props(styles.cardBody)}>{rule.body}</p>
              </div>
              <div {...stylex.props(styles.example)}>{rule.example()}</div>
            </li>
          ))}
        </ol>
      </VoiceSection>

      <VoiceSection
        heading="Real strings, rewritten"
        intro="Preserve the useful fact. Remove the brochure voice, empty praise, and jokes that get in the way."
      >
        <div role="table" aria-label="Peated copy examples">
          <div role="row" {...stylex.props(styles.comparisonHeader)}>
            <span role="columnheader">Don’t</span>
            <span role="columnheader">Do</span>
            <span role="columnheader">Why</span>
          </div>
          {comparisons.map((comparison) => (
            <div
              role="row"
              key={comparison.before}
              {...stylex.props(styles.comparisonRow)}
            >
              <div role="cell" {...stylex.props(styles.comparisonCell)}>
                <span {...stylex.props(styles.mobileLabel)}>Don’t</span>
                <s {...stylex.props(styles.before)}>{comparison.before}</s>
              </div>
              <div role="cell" {...stylex.props(styles.comparisonCell)}>
                <span {...stylex.props(styles.mobileLabel)}>Do</span>
                <strong {...stylex.props(styles.after)}>
                  {comparison.after}
                </strong>
              </div>
              <div role="cell" {...stylex.props(styles.comparisonCell)}>
                <span {...stylex.props(styles.mobileLabel)}>Why</span>
                <span {...stylex.props(styles.reason)}>
                  {comparison.reason}
                </span>
              </div>
            </div>
          ))}
        </div>
      </VoiceSection>

      <VoiceSection heading="One fact, 3 voices">
        <div {...stylex.props(styles.failureGrid)}>
          <VoiceExample label="Too reverent" note="Reads as pretension">
            “A dram of remarkable provenance, matured for forty-six years in the
            cool Islay air.”
          </VoiceExample>
          <VoiceExample label="Too laddish" note="Treats the record as a joke">
            “46 years old and absolutely sending it. Get involved.”
          </VoiceExample>
          <VoiceExample
            selected
            label="Peated"
            note="Affectionate, honest, faintly amused"
          >
            “Forty-six years in and the smoke has turned to embers —
            extraordinary, and priced accordingly.”
          </VoiceExample>
        </div>
      </VoiceSection>

      <VoiceSection heading="Mechanics">
        <div {...stylex.props(styles.mechanicsGrid)}>
          {mechanics.map((item) => (
            <div key={item.title} {...stylex.props(styles.mechanicCard)}>
              <h3 {...stylex.props(styles.mechanicTitle)}>{item.title}</h3>
              <p {...stylex.props(styles.mechanicBody)}>{item.body}</p>
            </div>
          ))}
        </div>
      </VoiceSection>
    </article>
  );
}

function VoiceSection({
  children,
  heading,
  intro,
}: {
  children: ReactNode;
  heading: string;
  intro?: string;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <div {...stylex.props(styles.sectionHeader)}>
        <SectionHeading>{heading}</SectionHeading>
        {intro ? <p {...stylex.props(styles.sectionIntro)}>{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

function PositionCard({
  accent = false,
  children,
  label,
}: {
  accent?: boolean;
  children: ReactNode;
  label: string;
}) {
  return (
    <div {...stylex.props(styles.positionCard)}>
      <div
        {...stylex.props(styles.microLabel, accent && styles.accentMicroLabel)}
      >
        {label}
      </div>
      <p {...stylex.props(styles.positionBody)}>{children}</p>
    </div>
  );
}

function WordList({
  accent = false,
  label,
  words,
}: {
  accent?: boolean;
  label: string;
  words: string;
}) {
  return (
    <div {...stylex.props(styles.wordList)}>
      <div
        {...stylex.props(styles.microLabel, accent && styles.accentMicroLabel)}
      >
        {label}
      </div>
      <div {...stylex.props(styles.words)}>{words}</div>
    </div>
  );
}

function RegisterRow({ label, value }: { label: string; value: string }) {
  return (
    <div {...stylex.props(styles.registerRow)}>
      <dt>{label}</dt>
      <dd {...stylex.props(styles.registerValue)}>{value}</dd>
    </div>
  );
}

function VoiceExample({
  children,
  label,
  note,
  selected = false,
}: {
  children: ReactNode;
  label: string;
  note: string;
  selected?: boolean;
}) {
  return (
    <div
      {...stylex.props(styles.voiceExample, selected && styles.selectedExample)}
    >
      <div
        {...stylex.props(
          styles.microLabel,
          selected && styles.accentMicroLabel,
        )}
      >
        {label}
      </div>
      <p {...stylex.props(styles.voiceQuote)}>{children}</p>
      <div {...stylex.props(styles.voiceNote)}>{note}</div>
    </div>
  );
}

const styles = stylex.create({
  page: {
    width: "100%",
    maxWidth: "1120px",
  },
  hero: {
    paddingBottom: space.x12,
  },
  title: {
    marginTop: space.x3,
  },
  lede: {
    maxWidth: "680px",
    marginTop: space.x6,
    marginBottom: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "16px",
    lineHeight: 1.6,
  },
  positionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "6px",
    marginTop: space.x6,
    [MOBILE]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  positionCard: {
    paddingTop: space.x4,
    paddingRight: "18px",
    paddingBottom: space.x4,
    paddingLeft: "18px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  microLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  accentMicroLabel: {
    color: colors.accentDeep,
  },
  positionBody: {
    marginTop: "6px",
    marginBottom: 0,
    color: colors.ink,
    fontSize: "14px",
    lineHeight: 1.55,
  },
  section: {
    paddingTop: space.x12,
    paddingBottom: space.x12,
    borderTopWidth: "2px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
  },
  sectionHeader: {
    marginBottom: space.x4,
  },
  sectionIntro: {
    maxWidth: "680px",
    marginTop: space.x2,
    marginBottom: 0,
    color: colors.inkMuted,
    fontSize: "14px",
    lineHeight: 1.55,
  },
  ruleList: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "6px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    [NARROW]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  ruleCard: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x4,
    padding: space.x6,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
    [MOBILE]: {
      padding: space.x4,
    },
  },
  ruleWide: {
    gridColumn: "1 / -1",
  },
  ruleCopy: {
    maxWidth: "680px",
  },
  cardTitle: {
    margin: 0,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  cardBody: {
    marginTop: space.x2,
    marginBottom: 0,
    color: colors.inkMuted,
    fontSize: "14px",
    lineHeight: 1.55,
  },
  example: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x2,
    padding: space.x4,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.ground,
    color: colors.ink,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  wordLists: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "6px",
    [NARROW]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  wordList: {
    padding: space.x4,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  words: {
    marginTop: "6px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "12px",
    lineHeight: 1.7,
  },
  registerList: {
    margin: 0,
  },
  registerRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x4,
    paddingTop: "10px",
    paddingBottom: "10px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    fontSize: "13px",
    fontWeight: 600,
    ":last-child": {
      borderBottomWidth: 0,
    },
    [MOBILE]: {
      alignItems: "flex-start",
      flexDirection: "column",
      gap: space.x1,
    },
  },
  registerValue: {
    margin: 0,
    color: colors.accentDeep,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontWeight: 400,
    lineHeight: 1.3,
  },
  comparisonHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 0.85fr",
    gap: space.x4,
    paddingBottom: space.x2,
    borderBottomWidth: "2px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
    [NARROW]: {
      display: "none",
    },
  },
  comparisonRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 0.85fr",
    gap: space.x4,
    paddingTop: "14px",
    paddingBottom: "14px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    [NARROW]: {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: space.x3,
    },
  },
  comparisonCell: {
    minWidth: 0,
  },
  mobileLabel: {
    display: "none",
    marginBottom: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
    [NARROW]: {
      display: "block",
    },
  },
  before: {
    color: colors.inkMuted,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  after: {
    color: colors.ink,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  reason: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.5,
  },
  failureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "6px",
    [NARROW]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  voiceExample: {
    padding: space.x6,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  selectedExample: {
    boxShadow: `inset 0 0 0 2px ${colors.accent}`,
  },
  voiceQuote: {
    marginTop: space.x2,
    marginBottom: 0,
    color: colors.inkMuted,
    fontSize: "15px",
    lineHeight: 1.55,
  },
  voiceNote: {
    marginTop: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.4,
  },
  mechanicsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "6px",
    [NARROW]: {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    [MOBILE]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  mechanicCard: {
    paddingTop: space.x4,
    paddingRight: "18px",
    paddingBottom: space.x4,
    paddingLeft: "18px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  mechanicTitle: {
    margin: 0,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.3,
  },
  mechanicBody: {
    marginTop: space.x1,
    marginBottom: 0,
    color: colors.inkMuted,
    fontSize: "13px",
    lineHeight: 1.5,
  },
});
