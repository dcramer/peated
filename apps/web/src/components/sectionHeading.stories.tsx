import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SectionHeading } from "./sectionHeading.stylex";
import { StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Data Display/Section Heading",
  component: SectionHeading,
  args: { children: "Similar bottles", count: 12 },
} satisfies Meta<typeof SectionHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <SectionHeading {...args} />
      <SectionHeading count={12}>Similar bottles</SectionHeading>
      <SectionHeading count={2841}>Tastings</SectionHeading>
      <SectionHeading count={0}>Critic reviews</SectionHeading>
      <SectionHeading>History</SectionHeading>
    </StoryStack>
  ),
};
