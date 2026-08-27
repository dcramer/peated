import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import RobotImage from "../../../assets/robot.png";
import { StoryCanvas } from "../storyFixtures.stylex";
import { PictureInput } from "./tastingInputs.stylex";

const meta = {
  title: "Components/Forms/Picture Input",
  component: PictureInput,
  decorators: [
    (Story) => (
      <StoryCanvas>
        <Story />
      </StoryCanvas>
    ),
  ],
  args: {
    id: "picture",
    name: "picture",
    onFilesSelected: () => undefined,
  },
} satisfies Meta<typeof PictureInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithPicture: Story = {
  args: {
    onRemove: () => undefined,
    preview: {
      alt: "Current tasting picture",
      src: RobotImage.src,
    },
  },
};

export const Disabled: Story = { args: { disabled: true } };
