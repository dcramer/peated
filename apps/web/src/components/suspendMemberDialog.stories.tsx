import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent } from "storybook/test";

import { SuspendMemberDialog } from "./suspendMemberDialog";

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 300));

const meta = {
  title: "Components/Forms/Suspend Member Dialog",
  component: SuspendMemberDialog,
  args: {
    isOpen: true,
    onCancel: fn(),
    onSubmit: fn(wait),
    username: "islaydrinker",
  },
  parameters: {
    docs: {
      description: {
        component:
          "Moderators explain why a member is being suspended. The reason is shown to the member.",
      },
    },
  },
} satisfies Meta<typeof SuspendMemberDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A reason is required before the member can be suspended. */
export const RequiresReason: Story = {
  play: async ({ args }) => {
    await userEvent.click(
      await screen.findByRole("button", { name: "Suspend member" }),
    );
    await expect(
      await screen.findByText("A reason is required."),
    ).toBeInTheDocument();
    await expect(args.onSubmit).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Reason"), "Repeated spam.");
    await userEvent.click(
      screen.getByRole("button", { name: "Suspend member" }),
    );
    await expect(args.onSubmit).toHaveBeenCalledWith("Repeated spam.");
  },
};
