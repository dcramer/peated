import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  LoadingList,
  LoadingPlaceholder,
  LoadingText,
} from "@peated/web/components/feedback.stylex";
import { FilterRailLoading } from "@peated/web/components/filterPanel.stylex";
import { ListToolbarLoading } from "@peated/web/components/lists.stylex";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, controlMetrics, space } from "../../styles/tokens.stylex";
import { PageColumns } from "./pageLayout.stylex";

const NARROW = "@media (max-width: 959px)";
const VERY_NARROW = "@media (max-width: 359px)";

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
      <PageColumns
        rail={
          <FilterRailLoading
            groups={
              variant === "bottle"
                ? [
                    { label: "Category", rows: 6 },
                    { label: "Age statement", rows: 5 },
                  ]
                : [{ label: "Country", rows: 6 }]
            }
            searchLabel={<LoadingText width="7em" />}
          />
        }
      >
        <div {...stylex.props(styles.loadingResults)}>
          <ListToolbarLoading mobileActionLayout="pageColumns" />
          <LoadingList
            label="Loading catalog records"
            rows={4}
            variant={variant === "entity" ? "text" : "standard"}
          />
        </div>
      </PageColumns>
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
    [VERY_NARROW]: {
      flexDirection: "column",
      gap: space.x3,
    },
  },
  titleRowWithNavigation: {
    marginBottom: space.x2,
  },
  navigation: {
    marginBottom: space.x6,
  },
  loadingResults: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x4,
  },
  loadingAction: {
    width: "104px",
    height: controlMetrics.controlHeight,
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
});
