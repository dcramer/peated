import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ItemList, ItemRow } from "./itemList.stylex";
import { SectionHeading } from "./sectionHeading.stylex";
import { StoryStack } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Layout/Section Heading",
  component: SectionHeading,
  args: { children: "Distilleries" },
  parameters: {
    docs: {
      description: {
        component:
          "Use SectionHeading for every section heading, including sidebars. The shared 24px heading sits above 18px row titles. Heading levels change document structure, not appearance. Keep spacing in the containing layout; do not add local typography variants.",
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
      <ItemList ariaLabel="Distilleries">
        <ItemRow title="Ardbeg" metadata="Islay · Scotland" href="#ardbeg" />
      </ItemList>
      <SectionHeading>History</SectionHeading>
      <SectionHeading level={3}>Details</SectionHeading>
    </StoryStack>
  ),
};
