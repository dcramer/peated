import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BandStack } from "./scoring.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

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
  args: { counts, showCounts: true },
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
      <BandStack counts={{}} />
    </StoryStack>
  ),
};
