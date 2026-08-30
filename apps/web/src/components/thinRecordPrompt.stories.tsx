import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button, ButtonLink } from "./button.stylex";
import { ThinRecordPrompt } from "./editorial.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Editorial/Thin record prompt",
  component: ThinRecordPrompt,
  args: {
    children: "This record has the name, but not much else yet.",
    heading: "There is more to record here.",
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof ThinRecordPrompt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  args: {
    actions: (
      <>
        <Button variant="accent">Add bottle details</Button>
        <ButtonLink href="#history" variant="tonal">
          View history
        </ButtonLink>
      </>
    ),
    prompts: [
      { label: "people have logged another release", value: 184 },
      { label: "related bottles have a photo", value: 12 },
      { label: "catalog changes this month", value: 47 },
    ],
  },
};
