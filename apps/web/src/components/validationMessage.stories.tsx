import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ValidationMessage } from "./field.stylex";

const meta = {
  title: "Components/Forms/Validation Message",
  component: ValidationMessage,
  args: { children: "One field needs attention before publishing." },
} satisfies Meta<typeof ValidationMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
