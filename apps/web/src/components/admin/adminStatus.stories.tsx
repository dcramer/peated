import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas, StoryRow } from "../storyFixtures.stylex";
import { AdminStatus } from "./adminContent.stylex";

const meta = {
  title: "Admin/Status",
  component: AdminStatus,
  args: { children: "Waiting" },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof AdminStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => (
    <StoryRow>
      <AdminStatus>Waiting</AdminStatus>
      <AdminStatus tone="accent">In progress</AdminStatus>
      <AdminStatus tone="success">Active</AdminStatus>
      <AdminStatus tone="warning">Needs review</AdminStatus>
      <AdminStatus tone="danger">Failed</AdminStatus>
    </StoryRow>
  ),
};
