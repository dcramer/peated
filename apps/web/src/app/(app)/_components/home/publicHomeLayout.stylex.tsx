import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { ButtonLink } from "@peated/web/components/button.stylex";
import {
  HomeActivityFeedLoading,
  HomeContributionPrompt,
  HomeDistilleriesLoading,
  HomeLatestReleasesLoading,
  HomeOriginsLoading,
} from "@peated/web/components/pages/homeBrowse.stylex";
import { PageColumns } from "@peated/web/components/pages/pageLayout.stylex";
import { space } from "../../../../styles/tokens.stylex";

export function PublicHomeContentLayout({
  children,
  rail,
}: {
  children: ReactNode;
  rail: ReactNode;
}) {
  return (
    <PageColumns rail={rail} railBehavior="stack">
      <div {...stylex.props(styles.sections)}>{children}</div>
    </PageColumns>
  );
}

export function PublicHomeSecondaryRail({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.secondaryRail)}>{children}</div>;
}

/** Keeps the home sections in place while their server data loads. */
export function PublicHomeContentLoading() {
  return (
    <PublicHomeContentLayout
      rail={
        <>
          <PublicHomeSecondaryRail>
            <HomeDistilleriesLoading />
            <HomeContributionPrompt
              primaryAction={
                <ButtonLink href="/register" size="sm" variant="accent">
                  Create an account
                </ButtonLink>
              }
              secondaryAction={
                <ButtonLink href="/bottles" size="sm" variant="text">
                  Or keep browsing
                </ButtonLink>
              }
            />
          </PublicHomeSecondaryRail>
        </>
      }
    >
      <HomeLatestReleasesLoading />
      <HomeActivityFeedLoading />
      <div {...stylex.props(styles.desktopOnly)}>
        <HomeOriginsLoading />
      </div>
    </PublicHomeContentLayout>
  );
}

const NARROW = "@media (max-width: 759px)";

const styles = stylex.create({
  desktopOnly: {
    display: "block",
    [NARROW]: {
      display: "none",
    },
  },
  sections: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x12,
  },
  secondaryRail: {
    display: "flex",
    flexDirection: "column",
    gap: space.x12,
  },
});
