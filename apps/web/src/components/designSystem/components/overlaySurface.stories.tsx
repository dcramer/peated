import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as stylex from "@stylexjs/stylex";

import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  StoryCanvas,
  StoryStack,
  StorySurfaceContent,
} from "../storyFixtures.stylex";
import { OverlaySurface } from "./feedback.stylex";

const meta = {
  title: "Components/Feedback/Overlay Surface",
  component: OverlaySurface,
  args: {
    children: (
      <StorySurfaceContent>
        <strong {...stylex.props(foundationStyles.rowTitle)}>
          Port Charlotte 10
        </strong>
        <span {...stylex.props(foundationStyles.metadata)}>
          Islay · 10 yr · 50.0%
        </span>
      </StorySurfaceContent>
    ),
  },
  argTypes: { children: { table: { disable: true } } },
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
} satisfies Meta<typeof OverlaySurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: (args) => (
    <StoryStack>
      <OverlaySurface {...args} />
      <OverlaySurface>
        <StorySurfaceContent>
          <strong {...stylex.props(foundationStyles.rowTitle)}>Saved</strong>
          <span {...stylex.props(foundationStyles.metadata)}>
            Your tasting is now visible to friends.
          </span>
        </StorySurfaceContent>
      </OverlaySurface>
    </StoryStack>
  ),
};
