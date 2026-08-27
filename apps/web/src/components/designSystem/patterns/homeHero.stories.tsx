import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ButtonLink } from "../components";
import { StoryCanvas } from "../storyFixtures.stylex";
import { HomeHero } from "./homeSections.stylex";

const meta = {
  title: "Patterns/Home/Hero",
  component: HomeHero,
  args: {
    description:
      "Peated is a whisky database: bottlings down to the cask, critic scores kept per release, and your own tastings and collection alongside them.",
    facts: [
      { label: "Bottles", value: "47,402" },
      { label: "Distilleries", value: "1,891" },
      { label: "Tastings recorded", value: "312k" },
    ],
    primaryAction: (
      <ButtonLink href="/register" size="lg" variant="accent">
        Create an account
      </ButtonLink>
    ),
    secondaryAction: (
      <ButtonLink href="/bottles" size="lg" variant="tonal">
        Browse the database
      </ButtonLink>
    ),
    title: "Every bottle, every review, in one place.",
  },
  argTypes: {
    description: { control: false },
    facts: { control: false },
    primaryAction: { control: false },
    secondaryAction: { control: false },
    title: { control: false },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof HomeHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
