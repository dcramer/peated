import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as stylex from "@stylexjs/stylex";

import { colors, fonts } from "../styles/tokens.stylex";
import { ItemList, ItemRow, type ItemListVariant } from "./itemList.stylex";
import { RatingMeasure } from "./scoring.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

function InteractionRows({
  idPrefix,
  variant,
}: {
  idPrefix: string;
  variant: ItemListVariant;
}) {
  const geometry =
    variant === "plain" ? "12px padded overhang" : "Contained by the surface";

  return (
    <ItemList
      ariaLabel={`${variant} linked row interaction states`}
      variant={variant}
    >
      <ItemRow
        href="#default"
        id={`${idPrefix}-default-row`}
        metadata={geometry}
        title="Default"
        variant={variant}
      />
      <ItemRow
        href="#hovered"
        id={`${idPrefix}-hovered-row`}
        metadata="Tonal hover"
        title="Hovered"
        variant={variant}
      />
      <ItemRow
        href="#focused"
        id={`${idPrefix}-focused-row`}
        metadata="Inset keyboard-focus ring"
        title="Keyboard focused"
        variant={variant}
      />
      <ItemRow
        href="#bottle"
        id={`${idPrefix}-nested-row`}
        metadata={
          <a href="#publication" {...stylex.props(styles.secondaryLink)}>
            Publication link
          </a>
        }
        title="Primary row with a nested link"
        variant={variant}
      />
      <ItemRow
        href="#pressed"
        id={`${idPrefix}-pressed-row`}
        metadata="Accent-tint pressed state"
        title="Pressed"
        variant={variant}
      />
    </ItemList>
  );
}

const meta = {
  title: "Components/Data Display/Item List",
  component: ItemList,
  args: { ariaLabel: "Records", children: null },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof ItemList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <StoryStack>
      <ItemList ariaLabel="Recently added bottles" variant="surface">
        <ItemRow
          href="#lagavulin"
          metadata="16 years · 43.0% ABV"
          size="sm"
          title="Lagavulin 16-year-old"
          variant="surface"
        />
        <ItemRow
          href="#macallan"
          metadata="12 years · 43.0% ABV"
          size="sm"
          title="The Macallan 12-year-old Sherry Oak"
          variant="surface"
        />
        <ItemRow
          href="#springbank"
          metadata="10 years · 46.0% ABV"
          size="sm"
          title="Springbank 10-year-old"
          variant="surface"
        />
      </ItemList>
      <ItemList ariaLabel="Rated bottles">
        <ItemRow
          end={
            <RatingMeasure
              counts={{
                good: 8,
                mediocre: 2,
                outstanding: 42,
                unicorn: 10,
                very_good: 18,
              }}
              high={97}
              low={83}
              median={91}
              scoreCount={28}
            />
          }
          href="#yamazaki"
          metadata="Japan · 12 years · 43.0% ABV"
          title="Yamazaki 12-year-old"
        />
        <ItemRow
          href="#blended-malt"
          metadata="Glen Moray, Caol Ila, Glen Spey · 36 years · 52.4% ABV"
          metadataWrap
          title="Long release metadata"
        />
      </ItemList>
    </StoryStack>
  ),
};

export const InteractionStates: Story = {
  render: () => (
    <StoryStack>
      <InteractionRows idPrefix="plain" variant="plain" />
      <InteractionRows idPrefix="surface" variant="surface" />
    </StoryStack>
  ),
  parameters: {
    pseudo: {
      active: ["#plain-pressed-row > div", "#surface-pressed-row > div"],
      focusWithin: ["#plain-focused-row > div", "#surface-focused-row > div"],
      hover: ["#plain-hovered-row > div", "#surface-hovered-row > div"],
    },
  },
};

const styles = stylex.create({
  secondaryLink: {
    position: "relative",
    zIndex: 2,
    color: {
      default: colors.inkMuted,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
    fontFamily: fonts.data,
    fontSize: "11px",
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "2px",
  },
});
