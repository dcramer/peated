import * as stylex from "@stylexjs/stylex";

import {
  Card,
  RailList,
  RailListItem,
  TextLink,
} from "@peated/web/components/designSystem/components";
import { PageSection } from "@peated/web/components/designSystem/patterns/pageLayout.stylex";
import { colors, fonts, space } from "../../../../../styles/tokens.stylex";

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
        <Card appearance="surface" padding="sm">
          <div {...stylex.props(styles.intro)}>
            <p {...stylex.props(styles.paragraph)}>
              {entityName} uses the number before the decimal point to identify
              the distillery. For example, cask 4.360 is the 360th cask from
              distillery 4,{" "}
              <TextLink href={example.href}>{example.name}</TextLink>.
            </p>
            <p {...stylex.props(styles.paragraph)}>
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
          count={group.rows.length}
          heading={
            group.code ? `${group.heading} (${group.code})` : group.heading
          }
          key={group.code || group.heading}
        >
          <RailList ariaLabel={`${group.heading} distillery codes`}>
            {group.rows.map((row) => (
              <RailListItem
                end={<span {...stylex.props(styles.code)}>{row.code}</span>}
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
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.6,
  },
  code: {
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
  },
});
