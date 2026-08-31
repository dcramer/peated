import * as stylex from "@stylexjs/stylex";
import { Camera } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "..";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, controlMetrics, space } from "../../styles/tokens.stylex";

export function BottleResolverColumn({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.column)}>{children}</div>;
}

export function BottleResolverInlineAction({
  children,
}: {
  children: ReactNode;
}) {
  return <div {...stylex.props(styles.inlineAction)}>{children}</div>;
}

export function BottleResolverIntroduction({
  description,
  title,
}: {
  description: ReactNode;
  title: ReactNode;
}) {
  return (
    <header {...stylex.props(styles.introduction)}>
      <h2 {...stylex.props(foundationStyles.pageTitle)}>{title}</h2>
      <div
        {...stylex.props(foundationStyles.body, styles.introductionDescription)}
      >
        {description}
      </div>
    </header>
  );
}

export function BottleResolverSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      {title || description ? (
        <div {...stylex.props(styles.sectionHeader)}>
          {title ? (
            <h2 {...stylex.props(foundationStyles.sectionHeading)}>{title}</h2>
          ) : null}
          {description ? (
            <div
              {...stylex.props(
                foundationStyles.body,
                styles.sectionDescription,
              )}
            >
              {description}
            </div>
          ) : null}
        </div>
      ) : null}
      <div {...stylex.props(styles.sectionContent)}>{children}</div>
    </section>
  );
}

export function BottlePhotoAction({
  onSelectPhoto,
}: {
  onSelectPhoto: () => void;
}) {
  return (
    <section
      aria-label="Use a label photo"
      {...stylex.props(styles.photoAction)}
    >
      <span aria-hidden="true" {...stylex.props(styles.photoVisual)}>
        <Camera size={30} strokeWidth={1.5} />
      </span>
      <div {...stylex.props(styles.photoCopy)}>
        <h2
          {...stylex.props(
            foundationStyles.sectionHeading,
            styles.photoHeading,
          )}
        >
          Photograph the label
        </h2>
        <p
          {...stylex.props(foundationStyles.metadata, styles.photoDescription)}
        >
          Keep the whole front label in frame. A phone photo is fine; we’ll use
          it as your tasting picture too.
        </p>
        <span {...stylex.props(styles.photoButton)}>
          <Button fullWidth onClick={onSelectPhoto} size="md" variant="default">
            Photograph the label
          </Button>
        </span>
      </div>
    </section>
  );
}

const styles = stylex.create({
  column: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    maxWidth: "620px",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x6,
    marginRight: "auto",
    marginLeft: "auto",
  },
  introduction: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x3,
    paddingBottom: space.x1,
  },
  inlineAction: {
    alignSelf: "flex-start",
  },
  introductionDescription: {
    maxWidth: "520px",
    color: colors.inkMuted,
    textWrap: "pretty",
  },
  section: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x4,
  },
  sectionHeader: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x2,
  },
  sectionDescription: {
    maxWidth: "560px",
    color: colors.inkMuted,
    textWrap: "pretty",
  },
  sectionContent: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x4,
  },
  photoAction: {
    boxSizing: "border-box",
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x6,
    paddingTop: space.x6,
    paddingRight: space.x6,
    paddingBottom: space.x6,
    paddingLeft: space.x6,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
    "@media (max-width: 559px)": {
      display: "block",
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      backgroundColor: "transparent",
    },
  },
  photoVisual: {
    boxSizing: "border-box",
    display: "grid",
    width: "76px",
    height: "104px",
    flex: "0 0 auto",
    placeItems: "center",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.surface,
    color: colors.inkMuted,
    "@media (max-width: 559px)": {
      display: "none",
    },
  },
  photoCopy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    rowGap: space.x2,
  },
  photoHeading: {
    "@media (max-width: 559px)": {
      display: "none",
    },
  },
  photoDescription: {
    maxWidth: "44ch",
    color: colors.inkMuted,
    "@media (max-width: 559px)": {
      order: 2,
    },
  },
  photoButton: {
    alignSelf: "flex-start",
    width: "fit-content",
    marginTop: space.x2,
    "@media (max-width: 559px)": {
      width: "100%",
      order: 1,
      marginTop: 0,
    },
  },
});
