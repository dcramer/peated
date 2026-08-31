import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SectionHeading } from "./sectionHeading.stylex";
import { StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Layout/Section Heading",
  component: SectionHeading,
  args: { children: "Similar bottles" },
} satisfies Meta<typeof SectionHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <SectionHeading {...args} />
      <SectionHeading>History</SectionHeading>
      <SectionHeading level={3}>Details</SectionHeading>
    </StoryStack>
  ),
};
