import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { LoadingList, LoadingPlaceholder } from "..";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, fonts, space } from "../../styles/tokens.stylex";

const NARROW = "@media (max-width: 759px)";

export function CatalogPage({
  action,
  children,
  eyebrow = "Whisky database",
  filters,
  navigation,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  eyebrow?: ReactNode;
  filters: ReactNode;
  navigation?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.page)}>
      <header
        {...stylex.props(
          styles.titleRow,
          navigation ? styles.titleRowWithNavigation : null,
        )}
      >
        <div>
          <div {...stylex.props(styles.eyebrow)}>{eyebrow}</div>
          <h1 {...stylex.props(foundationStyles.pageTitle)}>{title}</h1>
        </div>
        {action}
      </header>
      {navigation ? (
        <div {...stylex.props(styles.navigation)}>{navigation}</div>
      ) : null}
      <div {...stylex.props(styles.layout)}>
        <div {...stylex.props(styles.results)}>{children}</div>
        <aside {...stylex.props(styles.filters)}>{filters}</aside>
      </div>
    </div>
  );
}

export function CatalogPageLoading({ title }: { title: ReactNode }) {
  return (
    <CatalogPage
      filters={<LoadingList label="Loading catalog filters" rows={4} />}
      title={title}
    >
      <div {...stylex.props(styles.loadingResults)}>
        <LoadingPlaceholder preset="heading" />
        <LoadingList label="Loading catalog records" rows={4} />
      </div>
    </CatalogPage>
  );
}

const styles = stylex.create({
  page: {
    minWidth: 0,
  },
  titleRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.x4,
    marginBottom: space.x6,
    [NARROW]: {
      alignItems: "flex-start",
    },
  },
  titleRowWithNavigation: {
    marginBottom: space.x2,
  },
  navigation: {
    marginBottom: space.x6,
  },
  eyebrow: {
    marginBottom: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  layout: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "minmax(0, 1fr) 300px",
    alignItems: "start",
    gap: space.x8,
    [NARROW]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  results: {
    minWidth: 0,
  },
  loadingResults: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x4,
  },
  filters: {
    minWidth: 0,
    [NARROW]: {
      gridRow: 1,
    },
  },
});
