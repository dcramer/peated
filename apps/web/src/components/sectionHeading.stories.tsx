import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SectionHeading } from "./sectionHeading.stylex";
import { StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Layout/Section Heading",
  component: SectionHeading,
  args: { children: "Similar bottles" },
  parameters: {
    docs: {
      description: {
        component:
          "Use SectionHeading for every section heading, including sidebars. Heading levels change document structure, not appearance. Keep spacing in the containing layout; do not add local typography variants.",
      },
    },
  },
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
