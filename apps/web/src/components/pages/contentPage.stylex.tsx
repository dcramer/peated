import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { SectionHeading } from "../sectionHeading.stylex";

import { TextLink, type TextLinkProps } from "..";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, fonts, space } from "../../styles/tokens.stylex";

export function ContentPage({
  children,
  eyebrow,
  intro,
  title,
}: {
  children: ReactNode;
  eyebrow?: ReactNode;
  intro?: ReactNode;
  title: ReactNode;
}) {
  return (
    <article {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.header)}>
        {eyebrow ? (
          <div {...stylex.props(styles.eyebrow)}>{eyebrow}</div>
        ) : null}
        <h1 {...stylex.props(foundationStyles.pageTitle)}>{title}</h1>
        {intro ? <div {...stylex.props(styles.intro)}>{intro}</div> : null}
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
  return <p {...stylex.props(styles.text)}>{children}</p>;
}

export function ContentList({ children }: { children: ReactNode }) {
  return <ul {...stylex.props(styles.list)}>{children}</ul>;
}

export function ContentLink({ children, ...props }: TextLinkProps) {
  return (
    <TextLink {...props} size="inherit">
      {children}
    </TextLink>
  );
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
  eyebrow: {
    marginBottom: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  intro: {
    maxWidth: "680px",
    marginTop: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "16px",
    lineHeight: 1.6,
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
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.7,
  },
  list: {
    display: "flex",
    maxWidth: "70ch",
    flexDirection: "column",
    rowGap: space.x2,
    margin: 0,
    paddingLeft: "20px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.6,
  },
});
