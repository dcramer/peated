import { SectionHeading } from "@peated/web/components/sectionHeading.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { TextLink, type TextLinkProps } from "@peated/web/components";
import {
  PageColumns,
  PageHeader,
  TabbedPage,
} from "@peated/web/components/pages/pageLayout.stylex";
import { colors, fonts, space } from "../../../styles/tokens.stylex";

const MOBILE = "@media (max-width: 559px)";
const STEPS_STACKED = "@media (max-width: 899px)";

const aboutTabs = [
  { href: "/about", label: "About" },
  { href: "/about/api", label: "API" },
  { href: "/about/categories", label: "Whisky categories" },
  { href: "/about/tasting-wheel", label: "Tasting wheel" },
  { href: "/about/ratings", label: "Rating guide" },
  { href: "/updates", label: "Recent changes" },
] as const;

export function AboutPage({
  children,
  currentHref,
  description,
  rail,
  title,
}: {
  children: ReactNode;
  currentHref: string;
  description: ReactNode;
  rail?: ReactNode;
  title: ReactNode;
}) {
  return (
    <TabbedPage
      currentHref={currentHref}
      header={<PageHeader description={description} title={title} />}
      tabs={aboutTabs}
      tabsLabel="About Peated"
    >
      <PageColumns rail={rail} railBehavior="stack">
        {children}
      </PageColumns>
    </TabbedPage>
  );
}

export function AboutText({ children }: { children: ReactNode }) {
  return <p {...stylex.props(styles.text)}>{children}</p>;
}

export function AboutLink({ children, ...props }: TextLinkProps) {
  return (
    <TextLink {...props} size="inherit">
      {children}
    </TextLink>
  );
}

export function AboutTextStack({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.textStack)}>{children}</div>;
}

/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- Overflowing code must be keyboard-scrollable. */
export function AboutCode({ children }: { children: string }) {
  return (
    <pre
      aria-label="Example API request"
      role="region"
      tabIndex={0}
      {...stylex.props(styles.codeBlock)}
    >
      <code>{children}</code>
    </pre>
  );
}
/* oxlint-enable jsx-a11y/no-noninteractive-tabindex */

export function ReviewSteps({
  steps,
}: {
  steps: readonly { body: ReactNode; title: string }[];
}) {
  return (
    <ol {...stylex.props(styles.steps)}>
      {steps.map((step, index) => (
        <li key={step.title} {...stylex.props(styles.step)}>
          <span {...stylex.props(styles.stepNumber)}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <div {...stylex.props(styles.stepTitle)}>
            <SectionHeading level={3}>{step.title}</SectionHeading>
          </div>
          <div {...stylex.props(styles.stepBody)}>{step.body}</div>
        </li>
      ))}
    </ol>
  );
}

export function ReviewDirections({
  down,
  up,
}: {
  down: ReactNode;
  up: ReactNode;
}) {
  return (
    <dl {...stylex.props(styles.directions)}>
      <div>
        <dt {...stylex.props(styles.directionLabel)}>Move up for</dt>
        <dd {...stylex.props(styles.directionBody)}>{up}</dd>
      </div>
      <div>
        <dt {...stylex.props(styles.directionLabel)}>Move down for</dt>
        <dd {...stylex.props(styles.directionBody)}>{down}</dd>
      </div>
    </dl>
  );
}

const styles = stylex.create({
  textStack: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x3,
  },
  text: {
    maxWidth: "74ch",
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.7,
  },
  codeBlock: {
    maxWidth: "100%",
    margin: 0,
    padding: space.x4,
    overflowX: "auto",
    borderRadius: "3px",
    backgroundColor: colors.inset,
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "12px",
    lineHeight: 1.55,
  },
  steps: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(3, minmax(0, 1fr))",
      [STEPS_STACKED]: "minmax(0, 1fr)",
    },
    gap: space.x6,
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  step: {
    minWidth: 0,
    paddingTop: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
  stepNumber: {
    color: colors.accentDeep,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.3,
  },
  stepTitle: { marginTop: space.x2 },
  stepBody: {
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.55,
  },
  directions: {
    display: "grid",
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      [MOBILE]: "minmax(0, 1fr)",
    },
    gap: space.x6,
    margin: 0,
    paddingTop: space.x3,
  },
  directionLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.04em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  directionBody: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.55,
  },
});
