import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { RATING_BANDS, TastingRating } from "./scoring.stylex";
import { StoryRow, StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Ratings/Tasting Rating",
  component: TastingRating,
  args: { band: "outstanding" },
} satisfies Meta<typeof TastingRating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <StoryStack>
      <StoryRow>
        {RATING_BANDS.map((band) => (
          <TastingRating band={band.key} key={band.key} />
        ))}
      </StoryRow>
    </StoryStack>
  ),
};
