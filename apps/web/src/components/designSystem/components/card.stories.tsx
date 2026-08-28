import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryStack } from "../storyFixtures.stylex";
import { Card, CardLink } from "./card.stylex";
import { SectionHeading } from "./sectionHeading.stylex";

const meta = {
  title: "Components/Layout/Card",
  component: Card,
  args: { children: null },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <StoryStack>
      <Card>
        <SectionHeading count={312}>Distilleries</SectionHeading>
      </Card>
      <CardLink href="#lagavulin">
        <SectionHeading>Lagavulin</SectionHeading>
      </CardLink>
    </StoryStack>
  ),
};
