import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ButtonLink } from "./button.stylex";
import { LinkPendingIndicator } from "./linkPending.stylex";
import { StoryCanvas } from "./storyFixtures.stylex";

const meta = {
  title: "Components/Messages & Status/Link Pending",
  component: LinkPendingIndicator,
  args: { pending: true },
  render: (args) => (
    <StoryCanvas>
      <ButtonLink href="#next" variant="tonal">
        Next →
        <LinkPendingIndicator {...args} />
      </ButtonLink>
    </StoryCanvas>
  ),
} satisfies Meta<typeof LinkPendingIndicator>;

export default meta;
export const Overview: StoryObj<typeof meta> = {};
