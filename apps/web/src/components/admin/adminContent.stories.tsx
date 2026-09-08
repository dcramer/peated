import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryCanvas } from "../storyFixtures.stylex";
import {
  AdminDetailPageLoading,
  AdminListPageLoading,
  AdminOverviewPageLoading,
  AdminSectionsPageLoading,
} from "./adminContent.stylex";
import { ModerationSplitPageLoading } from "./moderation/inboxPage";

const meta = {
  title: "Admin/Page Loading",
  component: AdminOverviewPageLoading,
  decorators: [
    (Story) => (
      <StoryCanvas width="wide">
        <Story />
      </StoryCanvas>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AdminOverviewPageLoading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};

export const Table: Story = {
  render: () => (
    <AdminListPageLoading
      columns={3}
      label="Loading OAuth clients"
      title="OAuth clients"
    />
  ),
};

export const Detail: Story = {
  render: () => <AdminDetailPageLoading label="Loading event" />,
};

export const Sections: Story = {
  render: () => (
    <AdminSectionsPageLoading
      label="Loading background work"
      title="Background work"
    />
  ),
};

export const SplitView: Story = {
  render: () => <ModerationSplitPageLoading />,
};
