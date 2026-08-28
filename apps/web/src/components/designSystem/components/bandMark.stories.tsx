import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryRow, StoryStack } from "../storyFixtures.stylex";
import { BandMark, RATING_BANDS } from "./scoring.stylex";

const meta = {
  title: "Components/Measures/Band Mark",
  component: BandMark,
  args: { band: "outstanding" },
} satisfies Meta<typeof BandMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <StoryStack>
      <StoryRow>
        {RATING_BANDS.map((band) => (
          <BandMark band={band.key} key={band.key} />
        ))}
      </StoryRow>
    </StoryStack>
  ),
};
