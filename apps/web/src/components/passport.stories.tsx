import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Passport,
  type PassportProps,
  type PassportStamp,
} from "./passport.stylex";
import { StoryCanvas, StoryStack } from "./storyFixtures.stylex";

const islayStamps = [
  { label: "Ardbeg", stamped: true },
  { label: "Bowmore", stamped: true },
  { label: "Bruichladdich", stamped: true },
  { label: "Caol Ila", stamped: true },
  { label: "Kilchoman", stamped: true },
  { label: "Lagavulin", stamped: true },
  { label: "Laphroaig", stamped: true },
  { label: "Ardnahoe", stamped: false },
  { label: "Bunnahabhain", stamped: false },
  { label: "Malt Mill", stamped: false },
  { label: "Port Ellen", stamped: false },
  { label: "Port Charlotte", stamped: false },
] as const;

const largeStamps: readonly [PassportStamp, ...PassportStamp[]] = [
  { label: "Distillery 1", stamped: true },
  ...Array.from({ length: 31 }, (_, index) => ({
    label: `Distillery ${index + 2}`,
    stamped: index < 17,
  })),
];

const meta = {
  title: "Components/Members/Passport",
  component: Passport,
  args: {
    kind: "closed",
    stamps: islayStamps,
    unit: "distilleries",
  },
  argTypes: {
    stamps: { table: { disable: true } },
  },
  decorators: [
    (Story) => (
      <StoryCanvas width="compact">
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<PassportProps>;

export default meta;
type Story = StoryObj<PassportProps>;

export const Overview: Story = {
  render: (args: PassportProps) => (
    <StoryStack>
      <Passport {...args} />
      <Passport count={23} kind="open" nextStampIn={2} unit="bottles" />
      <Passport kind="closed" stamps={largeStamps} unit="distilleries" />
    </StoryStack>
  ),
};
