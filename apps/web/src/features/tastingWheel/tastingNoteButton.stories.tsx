import { TAG_CATEGORIES } from "@peated/server/constants";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryRow } from "../../components/storyFixtures.stylex";
import { TastingNoteButton } from "./tastingNoteButton.stylex";
import { WHEEL_CATEGORIES } from "./tastingWheelData";

const meta = {
  title: "Components/Reviews & Tastings/Tasting Note Button",
  component: TastingNoteButton,
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
  args: { category: "smoke", children: "peat" },
} satisfies Meta<typeof TastingNoteButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Categories: Story = {
  render: () => (
    <StoryRow>
      {TAG_CATEGORIES.map((category) => (
        <TastingNoteButton category={category} key={category}>
          {
            WHEEL_CATEGORIES.find((item) => item.key === category)!
              .wheelNotes[0]
          }
        </TastingNoteButton>
      ))}
    </StoryRow>
  ),
};

export const Selected: Story = {
  args: { selected: true },
};
