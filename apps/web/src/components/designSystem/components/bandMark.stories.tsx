import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryRow, StoryStack } from "../storyFixtures.stylex";
import { BandMark, RATING_BANDS } from "./scoring.stylex";

const meta = {
  title: "Components/Measures/Band Mark",
  component: BandMark,
  args: { value: { band: "outstanding", grain: "band" } },
} satisfies Meta<typeof BandMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <StoryStack>
      <StoryRow>
        {RATING_BANDS.map((band) => (
          <BandMark key={band.key} value={{ band: band.key, grain: "band" }} />
        ))}
      </StoryRow>
      <StoryRow>
        <BandMark value={{ grain: "point", point: 90 }} />
        <BandMark value={{ grain: "point", point: 92 }} />
        <BandMark value={{ grain: "point", point: 94 }} />
      </StoryRow>
    </StoryStack>
  ),
};
