import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as stylex from "@stylexjs/stylex";

import { colors, fonts } from "../styles/tokens.stylex";
import { ItemList, ItemRow } from "./itemList.stylex";
import { BottleRatings } from "./scoring.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

function InteractionRows() {
  return (
    <ItemList ariaLabel="Linked row interaction states">
      <ItemRow
        href="#default"
        id="default-row"
        metadata="12px padded overhang"
        title="Default"
      />
      <ItemRow
        href="#hovered"
        id="hovered-row"
        metadata="Tonal hover"
        title="Hovered"
      />
      <ItemRow
        href="#focused"
        id="focused-row"
        metadata="Inset keyboard-focus ring"
        title="Keyboard focused"
      />
      <ItemRow
        href="#bottle"
        id="nested-row"
        metadata={
          <a href="#publication" {...stylex.props(styles.secondaryLink)}>
            Publication link
          </a>
        }
        title="Primary row with a nested link"
      />
      <ItemRow
        href="#pressed"
        id="pressed-row"
        metadata="Accent-tint pressed state"
        title="Pressed"
      />
    </ItemList>
  );
}

const meta = {
  title: "Components/Lists & Tables/Item List",
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
      <ItemList ariaLabel="Recently added bottles">
        <ItemRow
          href="#lagavulin"
          metadata="16 years · 43.0% ABV"
          size="sm"
          title="Lagavulin 16-year-old"
        />
        <ItemRow
          href="#macallan"
          metadata="12 years · 43.0% ABV"
          size="sm"
          title="The Macallan 12-year-old Sherry Oak"
        />
        <ItemRow
          href="#springbank"
          metadata="10 years · 46.0% ABV"
          size="sm"
          title="Springbank 10-year-old"
        />
      </ItemList>
      <ItemList ariaLabel="Rated bottles">
        <ItemRow
          end={
            <BottleRatings
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
      <InteractionRows />
    </StoryStack>
  ),
  parameters: {
    pseudo: {
      active: ["#pressed-row > div"],
      focusWithin: ["#focused-row > div"],
      hover: ["#hovered-row > div"],
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
