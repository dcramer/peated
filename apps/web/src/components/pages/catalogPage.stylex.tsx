import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  LoadingList,
  LoadingPlaceholder,
} from "@peated/web/components/feedback.stylex";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, controlMetrics, space } from "../../styles/tokens.stylex";

const NARROW = "@media (max-width: 759px)";

export function CatalogPage({
  action,
  children,
  navigation,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
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
        <h1 {...stylex.props(foundationStyles.pageTitle)}>{title}</h1>
        {action}
      </header>
      {navigation ? (
        <div {...stylex.props(styles.navigation)}>{navigation}</div>
      ) : null}
      {children}
    </div>
  );
}

/** Matches catalog headers, controls, filters, and either bottle or text rows. */
export function CatalogPageLoading({
  action = true,
  navigation = false,
  title,
  variant = "bottle",
}: {
  action?: boolean;
  navigation?: boolean;
  title: ReactNode;
  variant?: "bottle" | "entity";
}) {
  return (
    <CatalogPage
      action={action ? <span {...stylex.props(styles.loadingAction)} /> : null}
      navigation={
        navigation ? (
          <div {...stylex.props(styles.loadingNavigation)}>
            <span {...stylex.props(styles.loadingTab)} />
            <span {...stylex.props(styles.loadingTab)} />
          </div>
        ) : null
      }
      title={title}
    >
      <div {...stylex.props(styles.layout)}>
        <div {...stylex.props(styles.loadingResults)}>
          {variant === "bottle" ? (
            <div {...stylex.props(styles.loadingSearch)}>
              <LoadingPlaceholder preset="metadata" />
              <span {...stylex.props(styles.loadingSearchControl)} />
            </div>
          ) : null}
          <div {...stylex.props(styles.loadingToolbar)}>
            <LoadingPlaceholder preset="text" />
            <span {...stylex.props(styles.loadingSort)} />
          </div>
          <LoadingList
            label="Loading catalog records"
            rows={4}
            variant={variant === "entity" ? "text" : "standard"}
          />
        </div>
        <aside {...stylex.props(styles.filters)}>
          <CatalogFiltersLoading query={variant === "bottle"} />
        </aside>
      </div>
    </CatalogPage>
  );
}

function CatalogFiltersLoading({ query }: { query: boolean }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading catalog filters"
      role="status"
      {...stylex.props(styles.loadingFilterPanel)}
    >
      <LoadingPlaceholder preset="metadata" />
      {query ? <span {...stylex.props(styles.loadingFilterControl)} /> : null}
      <div {...stylex.props(styles.loadingFacet)}>
        <LoadingPlaceholder delay={1} preset="metadata" />
        {([0, 1, 2, 3] as const).map((delay) => (
          <div
            aria-hidden="true"
            key={delay}
            {...stylex.props(styles.loadingOption)}
          >
            <span {...stylex.props(styles.loadingOptionMark)} />
            <LoadingPlaceholder delay={delay} preset="metadata" />
          </div>
        ))}
      </div>
    </div>
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
  filters: {
    minWidth: 0,
    [NARROW]: {
      display: "none",
    },
  },
  loadingResults: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x4,
  },
  loadingSearch: {
    display: "flex",
    flexDirection: "column",
    gap: space.x2,
    [NARROW]: {
      display: "none",
    },
  },
  loadingSearchControl: {
    display: "block",
    width: "min(100%, 520px)",
    height: "34px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  loadingAction: {
    width: "104px",
    height: "34px",
    flexShrink: 0,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  loadingNavigation: { display: "flex", gap: space.x4 },
  loadingTab: {
    width: "92px",
    height: "38px",
    borderBottomWidth: "2px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.surface,
  },
  loadingToolbar: {
    display: "flex",
    minHeight: "34px",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x4,
  },
  loadingSort: {
    width: "132px",
    height: "34px",
    flexShrink: 0,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  loadingFilterPanel: {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: space.x3,
    padding: space.x4,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
  },
  loadingFilterControl: {
    display: "none",
    width: "100%",
    height: "38px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
    [NARROW]: {
      display: "block",
    },
  },
  loadingFacet: {
    display: "flex",
    flexDirection: "column",
    gap: space.x3,
    paddingTop: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
  loadingOption: {
    display: "flex",
    minHeight: "24px",
    alignItems: "center",
    gap: space.x2,
  },
  loadingOptionMark: {
    width: "16px",
    height: "16px",
    flexShrink: 0,
    borderRadius: "50%",
    backgroundColor: colors.surface,
  },
});
