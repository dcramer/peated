import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryStack } from "../storyFixtures.stylex";
import { TextLink } from "./textLink.stylex";

const meta = {
  title: "Components/Navigation/Text Link",
  component: TextLink,
  args: {
    children: "Browse bottles",
    href: "#bottles",
  },
} satisfies Meta<typeof TextLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InteractionStates: Story = {
  render: (args) => (
    <StoryStack>
      <TextLink {...args} id="text-link-default" />
      <TextLink {...args} href="#hovered" id="text-link-hovered">
        Hovered
      </TextLink>
      <TextLink {...args} href="#focused" id="text-link-focused">
        Keyboard focused
      </TextLink>
      <TextLink {...args} href="#pressed" id="text-link-pressed">
        Pressed
      </TextLink>
    </StoryStack>
  ),
  parameters: {
    pseudo: {
      active: ["#text-link-pressed"],
      focusVisible: ["#text-link-focused"],
      hover: ["#text-link-hovered"],
    },
  },
};
