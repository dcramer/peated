import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Card, CardActionLink, CardLink, CardPrimaryLink } from "./card.stylex";
import { SectionHeading } from "./sectionHeading.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

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
        <SectionHeading>Distilleries</SectionHeading>
      </Card>
      <CardLink href="#lagavulin">
        <SectionHeading>Lagavulin</SectionHeading>
      </CardLink>
      <Card appearance="plain" linked>
        <CardPrimaryLink href="#springbank">
          <SectionHeading>Springbank 10-year-old</SectionHeading>
        </CardPrimaryLink>
        <CardActionLink href="#publication">Whisky Advocate</CardActionLink>
      </Card>
    </StoryStack>
  ),
};

export const InteractionStates: Story = {
  render: () => (
    <StoryStack>
      <CardLink href="#default" id="card-default">
        <SectionHeading>Default</SectionHeading>
      </CardLink>
      <CardLink href="#hovered" id="card-hovered">
        <SectionHeading>Hovered</SectionHeading>
      </CardLink>
      <Card id="card-focused" linked>
        <CardPrimaryLink href="#focused">
          <SectionHeading>Keyboard focused</SectionHeading>
        </CardPrimaryLink>
      </Card>
      <CardLink href="#pressed" id="card-pressed">
        <SectionHeading>Pressed</SectionHeading>
      </CardLink>
    </StoryStack>
  ),
  parameters: {
    pseudo: {
      active: ["#card-pressed"],
      focusWithin: ["#card-focused"],
      hover: ["#card-hovered"],
    },
  },
};
