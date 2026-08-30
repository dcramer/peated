import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { GlobalLoading } from "./globalLoading.stylex";

const meta = {
  title: "Components/Feedback/Global Loading",
  component: GlobalLoading,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof GlobalLoading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {};
