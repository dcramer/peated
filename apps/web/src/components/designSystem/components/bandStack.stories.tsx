import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryRow, StoryStack } from "../storyFixtures.stylex";
import { BandStack } from "./scoring.stylex";

const counts = {
  good: 568,
  mediocre: 312,
  outstanding: 796,
  unicorn: 199,
  very_good: 966,
};

const meta = {
  title: "Components/Measures/Band Stack",
  component: BandStack,
  args: { counts, showCounts: true, showRanges: true, variant: "full" },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof BandStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <BandStack {...args} />
      <StoryRow>
        <BandStack counts={counts} variant="compact" />
        <BandStack
          counts={{
            good: 2,
            mediocre: 1,
            outstanding: 18,
            unicorn: 1,
            very_good: 4,
          }}
          variant="compact"
        />
        <BandStack counts={{}} variant="compact" />
      </StoryRow>
      <BandStack counts={{}} />
    </StoryStack>
  ),
};
