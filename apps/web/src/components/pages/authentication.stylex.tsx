import * as stylex from "@stylexjs/stylex";
import NextLink from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { SectionHeading } from "../sectionHeading.stylex";

import { TextLink, type TextLinkProps } from "..";
import { foundationStyles } from "../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
  zIndices,
} from "../../styles/tokens.stylex";

const NARROW = "@media (max-width: 759px)";
const DARK = "@media (prefers-color-scheme: dark)";

export type AuthenticationFact = {
  label: string;
  value: ReactNode;
};

export type AuthenticationIntroProps = {
  artwork?: {
    alt: string;
    src: string;
  };
  description?: ReactNode;
  facts?: readonly AuthenticationFact[];
  footer?: ReactNode;
  loading?: boolean;
  points?: readonly ReactNode[];
  title: ReactNode;
};

export function AuthenticationIntro({
  artwork,
  description,
  facts,
  footer,
  loading = false,
  points,
  title,
}: AuthenticationIntroProps) {
  return (
    <aside aria-busy={loading || undefined} {...stylex.props(styles.intro)}>
      {artwork ? (
        <img
          alt={artwork.alt}
          src={artwork.src}
          {...stylex.props(styles.artwork)}
        />
      ) : null}
      <NextLink href="/" {...stylex.props(styles.brand)}>
        Peated
      </NextLink>
      <div {...stylex.props(styles.introBody)}>
        <h1
          {...stylex.props(
            foundationStyles.pageTitleCompact,
            styles.introTitle,
          )}
        >
          {title}
        </h1>
        {description ? (
          <div
            {...stylex.props(foundationStyles.prose, styles.introDescription)}
          >
            {description}
          </div>
        ) : null}
        {facts ? (
          <dl {...stylex.props(styles.facts)}>
            {facts.map((fact) => (
              <div key={fact.label}>
                <dd {...stylex.props(styles.factValue)}>{fact.value}</dd>
                <dt
                  {...stylex.props(foundationStyles.metadata, styles.factLabel)}
                >
                  {fact.label}
                </dt>
              </div>
            ))}
          </dl>
        ) : null}
        {points ? (
          <ul {...stylex.props(styles.points)}>
            {points.map((point, index) => (
              <li
                key={index}
                {...stylex.props(foundationStyles.body, styles.point)}
              >
                {point}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {footer ? (
        <div {...stylex.props(foundationStyles.metadata, styles.introFooter)}>
          {footer}
        </div>
      ) : null}
    </aside>
  );
}

export function AuthenticationLayout({
  children,
  intro,
}: {
  children: ReactNode;
  intro: ReactNode;
}) {
  return (
    <main {...stylex.props(foundationStyles.document, styles.shell)}>
      {intro}
      <div {...stylex.props(styles.panelColumn)}>{children}</div>
    </main>
  );
}

export function AuthenticationPanel({
  back,
  children,
  description,
  title,
}: {
  back?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.panel)}>
      {back ? <div {...stylex.props(styles.back)}>{back}</div> : null}
      <SectionHeading>{title}</SectionHeading>
      {description ? (
        <div {...stylex.props(foundationStyles.body, styles.panelDescription)}>
          {description}
        </div>
      ) : null}
      <div {...stylex.props(styles.panelContent)}>{children}</div>
    </section>
  );
}

export function AuthenticationCard({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.formSurface)}>{children}</div>;
}

export function AuthenticationActions({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.actionStack)}>{children}</div>;
}

export function AuthenticationDivider({ label }: { label?: string }) {
  return (
    <div aria-hidden="true" {...stylex.props(styles.divider)}>
      {label ? (
        <>
          <span {...stylex.props(styles.rule)} />
          <span
            {...stylex.props(foundationStyles.metadata, styles.dividerLabel)}
          >
            {label}
          </span>
          <span {...stylex.props(styles.rule)} />
        </>
      ) : null}
    </div>
  );
}

type AuthenticationLinkProps = TextLinkProps;

export function AuthenticationLink(props: AuthenticationLinkProps) {
  return <TextLink {...props} size="inherit" />;
}

export function AuthenticationTextButton({
  children,
  ...props
}: Omit<ComponentProps<"button">, "className" | "style">) {
  return (
    <button
      {...props}
      {...stylex.props(foundationStyles.interactiveSmall, styles.textButton)}
    >
      {children}
    </button>
  );
}

export function AuthenticationLinks({ children }: { children: ReactNode }) {
  return (
    <div {...stylex.props(foundationStyles.metadata, styles.footerLinks)}>
      {children}
    </div>
  );
}

export function AuthenticationNotice({ children }: { children: ReactNode }) {
  return (
    <div role="alert" {...stylex.props(foundationStyles.body, styles.notice)}>
      {children}
    </div>
  );
}

export function AuthenticationDetails({
  items,
}: {
  items: readonly ReactNode[];
}) {
  return (
    <ul {...stylex.props(styles.detailList)}>
      {items.map((item, index) => (
        <li
          key={index}
          {...stylex.props(foundationStyles.body, styles.detailListItem)}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

const styles = stylex.create({
  shell: {
    display: "grid",
    width: "100%",
    maxWidth: "1320px",
    minHeight: "100dvh",
    marginRight: "auto",
    marginLeft: "auto",
    gridTemplateColumns: "minmax(0, 1fr) 520px",
    backgroundColor: colors.ground,
    [NARROW]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  intro: {
    position: "relative",
    boxSizing: "border-box",
    display: "flex",
    minWidth: 0,
    minHeight: "100dvh",
    flexDirection: "column",
    paddingTop: `max(${space.x12}, env(safe-area-inset-top))`,
    paddingRight: "max(56px, env(safe-area-inset-right))",
    paddingBottom: `max(${space.x12}, env(safe-area-inset-bottom))`,
    paddingLeft: "max(56px, env(safe-area-inset-left))",
    backgroundColor: colors.ground,
    overflow: "hidden",
    [NARROW]: {
      minHeight: "auto",
      paddingTop: `max(${space.x6}, env(safe-area-inset-top))`,
      paddingRight: `max(${space.x6}, env(safe-area-inset-right))`,
      paddingBottom: space.x8,
      paddingLeft: `max(${space.x6}, env(safe-area-inset-left))`,
    },
  },
  brand: {
    position: "relative",
    zIndex: zIndices.localContent,
    alignSelf: "flex-start",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "32px",
    fontWeight: 700,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    textDecoration: "none",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    [NARROW]: {
      fontSize: "24px",
    },
  },
  introBody: {
    position: "relative",
    zIndex: zIndices.localContent,
    display: "flex",
    maxWidth: "440px",
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    paddingTop: space.x12,
    paddingBottom: space.x12,
    [NARROW]: {
      paddingTop: space.x8,
      paddingBottom: 0,
    },
  },
  introTitle: {
    maxWidth: "440px",
    margin: 0,
    color: colors.ink,
  },
  introDescription: {
    maxWidth: "440px",
    marginTop: space.x4,
    color: colors.inkMuted,
  },
  facts: {
    display: "grid",
    gridTemplateColumns: "repeat(2, max-content)",
    gap: "20px 44px",
    marginTop: space.x12,
    marginBottom: 0,
    [NARROW]: {
      gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
      gap: space.x4,
      marginTop: space.x8,
    },
  },
  factValue: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: 1.1,
    [NARROW]: {
      fontSize: "20px",
    },
  },
  factLabel: {
    marginTop: "2px",
    color: colors.inkMuted,
  },
  points: {
    margin: 0,
    marginTop: "22px",
    padding: 0,
    listStyle: "none",
  },
  point: {
    paddingTop: space.x3,
    paddingBottom: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    color: colors.inkMuted,
    ":first-child": {
      paddingTop: 0,
    },
    ":last-child": {
      paddingBottom: 0,
      borderBottomWidth: 0,
    },
  },
  introFooter: {
    position: "relative",
    zIndex: zIndices.localContent,
    color: colors.inkMuted,
    [NARROW]: {
      display: "none",
    },
  },
  artwork: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "54%",
    objectFit: "cover",
    objectPosition: "center 28%",
    opacity: {
      default: 0.14,
      [DARK]: 0.32,
    },
    filter: "grayscale(1) saturate(0.45)",
    maskImage:
      "linear-gradient(to bottom, transparent 0%, rgb(0 0 0 / 0.72) 36%, black 70%)",
    pointerEvents: "none",
    [NARROW]: {
      display: "none",
    },
  },
  panelColumn: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    paddingTop: `max(${space.x12}, env(safe-area-inset-top))`,
    paddingRight: "max(56px, env(safe-area-inset-right))",
    paddingBottom: `max(${space.x12}, env(safe-area-inset-bottom))`,
    paddingLeft: "max(56px, env(safe-area-inset-left))",
    [NARROW]: {
      paddingTop: space.x8,
      paddingRight: `max(${space.x6}, env(safe-area-inset-right))`,
      paddingBottom: `max(${space.x12}, env(safe-area-inset-bottom))`,
      paddingLeft: `max(${space.x6}, env(safe-area-inset-left))`,
    },
  },
  panel: {
    width: "100%",
  },
  back: {
    marginBottom: "14px",
  },
  panelDescription: {
    marginTop: space.x2,
    color: colors.inkMuted,
  },
  panelContent: {
    marginTop: "22px",
  },
  formSurface: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x3,
    paddingTop: "22px",
    paddingBottom: "22px",
    backgroundColor: "transparent",
  },
  actionStack: {
    display: "flex",
    flexDirection: "column",
    rowGap: "6px",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: space.x3,
    marginTop: "26px",
    marginBottom: "26px",
  },
  rule: {
    height: "1px",
    flex: 1,
    backgroundColor: colors.hairline,
  },
  dividerLabel: {
    color: colors.inkMuted,
  },
  textButton: {
    margin: 0,
    padding: 0,
    borderWidth: 0,
    outline: "none",
    backgroundColor: "transparent",
    color: colors.accentDeep,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    ":hover": {
      color: colors.accent,
    },
  },
  footerLinks: {
    display: "flex",
    alignItems: "baseline",
    gap: "6px 8px",
    color: colors.inkMuted,
    flexWrap: "wrap",
  },
  notice: {
    marginBottom: space.x3,
    padding: space.x4,
    borderRadius: controlMetrics.radius,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.accentTint,
    backgroundColor: "transparent",
    color: colors.accentDeep,
    fontWeight: 600,
  },
  detailList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  detailListItem: {
    paddingTop: space.x2,
    paddingBottom: space.x2,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    color: colors.inkMuted,
    ":first-child": {
      paddingTop: 0,
    },
    ":last-child": {
      paddingBottom: 0,
      borderBottomWidth: 0,
    },
  },
});
