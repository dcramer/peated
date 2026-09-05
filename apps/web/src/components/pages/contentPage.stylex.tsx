import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { SectionHeading } from "../sectionHeading.stylex";

import { TextLink, type TextLinkProps } from "..";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";

export function ContentPage({
  children,
  metadata,
  intro,
  title,
}: {
  children: ReactNode;
  metadata?: ReactNode;
  intro?: ReactNode;
  title: ReactNode;
}) {
  return (
    <article {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.header)}>
        <h1 {...stylex.props(foundationStyles.pageTitle)}>{title}</h1>
        {metadata ? (
          <div {...stylex.props(foundationStyles.metadata, styles.metadata)}>
            {metadata}
          </div>
        ) : null}
        {intro ? (
          <div {...stylex.props(foundationStyles.prose, styles.intro)}>
            {intro}
          </div>
        ) : null}
      </header>
      <div {...stylex.props(styles.body)}>{children}</div>
    </article>
  );
}

export function ContentSection({
  children,
  title,
}: {
  children: ReactNode;
  title: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <SectionHeading>{title}</SectionHeading>
      {children}
    </section>
  );
}

export function ContentSubsection({
  children,
  title,
}: {
  children: ReactNode;
  title: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.subsection)}>
      <SectionHeading level={3}>{title}</SectionHeading>
      {children}
    </section>
  );
}

export function ContentText({ children }: { children: ReactNode }) {
  return (
    <p {...stylex.props(foundationStyles.prose, styles.text)}>{children}</p>
  );
}

export function ContentList({ children }: { children: ReactNode }) {
  return (
    <ul {...stylex.props(foundationStyles.prose, styles.list)}>{children}</ul>
  );
}

export function ContentLink({ children, ...props }: TextLinkProps) {
  return <TextLink {...props}>{children}</TextLink>;
}

const styles = stylex.create({
  page: {
    width: "100%",
    maxWidth: "880px",
  },
  header: {
    maxWidth: "720px",
    paddingBottom: space.x6,
  },
  metadata: {
    marginTop: space.x2,
    color: colors.inkMuted,
  },
  intro: {
    maxWidth: "680px",
    marginTop: space.x3,
    color: colors.inkMuted,
  },
  body: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x8,
    paddingTop: space.x6,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x3,
  },
  subsection: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x2,
  },
  text: {
    maxWidth: "74ch",
    margin: 0,
    color: colors.inkMuted,
  },
  list: {
    display: "flex",
    maxWidth: "70ch",
    flexDirection: "column",
    rowGap: space.x2,
    margin: 0,
    paddingLeft: "20px",
    color: colors.inkMuted,
  },
});
