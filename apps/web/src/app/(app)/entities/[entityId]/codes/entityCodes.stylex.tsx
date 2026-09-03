import * as stylex from "@stylexjs/stylex";

import { Card, RailList, RailListItem, TextLink } from "@peated/web/components";
import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";
import { foundationStyles } from "../../../../../styles/foundations.stylex";
import { colors, space } from "../../../../../styles/tokens.stylex";

type CodeGroup = {
  code: string;
  heading: string;
  rows: readonly {
    code: string;
    country: string | null;
    href?: string;
    name: string;
  }[];
};

export function EntityCodes({
  entityName,
  example,
  groups,
}: {
  entityName: string;
  example: { href: string; name: string };
  groups: readonly CodeGroup[];
}) {
  return (
    <div {...stylex.props(styles.content)}>
      <PageSection heading="How the codes work">
        <Card appearance="plain" padding="sm">
          <div {...stylex.props(styles.intro)}>
            <p {...stylex.props(foundationStyles.body, styles.paragraph)}>
              {entityName} uses the number before the decimal point to identify
              the distillery. For example, cask 4.360 is the 360th cask from
              distillery 4,{" "}
              <TextLink href={example.href}>{example.name}</TextLink>.
            </p>
            <p {...stylex.props(foundationStyles.body, styles.paragraph)}>
              If a code is missing or incorrect, please report it in the{" "}
              <TextLink href="https://github.com/dcramer/peated/issues">
                Peated issue tracker
              </TextLink>
              .
            </p>
          </div>
        </Card>
      </PageSection>

      {groups.map((group) => (
        <PageSection
          heading={
            group.code ? `${group.heading} (${group.code})` : group.heading
          }
          key={group.code || group.heading}
        >
          <RailList ariaLabel={`${group.heading} distillery codes`}>
            {group.rows.map((row) => (
              <RailListItem
                end={
                  <span {...stylex.props(foundationStyles.code, styles.code)}>
                    {row.code}
                  </span>
                }
                href={row.href}
                key={row.code}
                metadata={row.country ?? undefined}
                title={row.name}
              />
            ))}
          </RailList>
        </PageSection>
      ))}
    </div>
  );
}

const styles = stylex.create({
  content: {
    minWidth: 0,
    paddingTop: space.x2,
  },
  intro: {
    display: "flex",
    flexDirection: "column",
    gap: space.x3,
  },
  paragraph: {
    margin: 0,
    color: colors.inkMuted,
  },
  code: {
    color: colors.ink,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
  },
});
