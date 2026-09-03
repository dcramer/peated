import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, effects, space } from "../../styles/tokens.stylex";
import issueText from "./scraperIssueText";

type Source = Outputs["externalSites"]["scrapeSources"]["list"][number];
type Result = Source["revisions"][number]["previewResult"];
type Page = Result["pages"][number];

const VISIBLE_PAGE_COUNT = 3;

function PreviewPage({ page }: { page: Page }) {
  return (
    <article {...stylex.props(styles.page)}>
      <a
        href={page.url}
        rel="noreferrer"
        target="_blank"
        {...stylex.props(styles.link)}
      >
        {page.url}
      </a>
      {page.kind === "review" ? (
        <div {...stylex.props(styles.body)}>
          <strong {...stylex.props(styles.title)}>{page.title}</strong>
          <span {...stylex.props(styles.muted)}>
            {page.reviews.length} review
            {page.reviews.length === 1 ? "" : "s"}
          </span>
          <ul {...stylex.props(styles.items)}>
            {page.reviews.map((review, index) => (
              <li key={`${review.name}-${index}`}>
                {review.name}
                {review.reviewerName ? ` · ${review.reviewerName}` : ""}
                {review.nativeScore !== null
                  ? ` · score ${review.nativeScore.display}`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul {...stylex.props(styles.items)}>
          {page.products.map((product, index) => (
            <li key={`${product.url}-${index}`}>
              {product.name} ·{" "}
              {(product.price / 100).toLocaleString(undefined, {
                style: "currency",
                currency: product.currency,
              })}{" "}
              · {product.volume} ml
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ScraperPreviewResult({ result }: { result: Result }) {
  const { issues, pages } = result;
  const visiblePages = pages.slice(0, VISIBLE_PAGE_COUNT);
  const morePages = pages.slice(VISIBLE_PAGE_COUNT);

  return (
    <div {...stylex.props(foundationStyles.metadata, styles.root)}>
      {issues.length > 0 ? (
        <ul {...stylex.props(styles.issues)}>
          {issues.map((issue, index) => (
            <li key={`${issue.field}-${index}`}>{issueText(issue.field)}</li>
          ))}
        </ul>
      ) : null}
      <div {...stylex.props(styles.pages)}>
        {visiblePages.map((page) => (
          <PreviewPage key={page.url} page={page} />
        ))}
        {morePages.length > 0 ? (
          <details {...stylex.props(styles.more)}>
            <summary {...stylex.props(styles.moreSummary)}>
              Show {morePages.length} more page
              {morePages.length === 1 ? "" : "s"}
            </summary>
            <div {...stylex.props(styles.moreList)}>
              {morePages.map((page) => (
                <PreviewPage key={page.url} page={page} />
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
    padding: space.x4,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    backgroundColor: "transparent",
    color: colors.ink,
  },
  issues: {
    margin: 0,
    paddingLeft: space.x6,
    color: colors.accentDeep,
  },
  pages: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
  },
  more: {
    paddingTop: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
  moreSummary: {
    color: colors.accentDeep,
    cursor: "pointer",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  moreList: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
    marginTop: space.x4,
  },
  page: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x2,
    paddingTop: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
  link: {
    color: { default: colors.accentDeep, ":hover": colors.accent },
    overflowWrap: "anywhere",
    textDecorationLine: { default: "none", ":hover": "underline" },
    textUnderlineOffset: "2px",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: space.x2,
  },
  title: { color: colors.ink },
  items: {
    display: "flex",
    flexDirection: "column",
    gap: space.x1,
    margin: 0,
    paddingLeft: space.x6,
  },
  muted: { color: colors.inkMuted },
});
