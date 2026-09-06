import { TAG_CATEGORIES } from "@peated/server/constants";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryRow } from "../../components/storyFixtures.stylex";
import { TastingNoteTag } from "./tastingNoteTag.stylex";
import { WHEEL_CATEGORIES } from "./tastingWheelData";

const meta = {
  title: "Components/Reviews & Tastings/Tasting Note Tag",
  component: TastingNoteTag,
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
  args: { category: "smoke", children: "peat" },
} satisfies Meta<typeof TastingNoteTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <StoryRow>
      {TAG_CATEGORIES.map((category) => (
        <TastingNoteTag category={category} key={category}>
          {
            WHEEL_CATEGORIES.find((item) => item.key === category)!
              .wheelNotes[0]
          }
        </TastingNoteTag>
      ))}
      <TastingNoteTag>uncategorized note</TastingNoteTag>
    </StoryRow>
  ),
};
