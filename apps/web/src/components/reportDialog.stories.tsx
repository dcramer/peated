import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent } from "storybook/test";

import { ReportDialog } from "./reportDialog";

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 300));

const meta = {
  title: "Components/Forms/Report Dialog",
  component: ReportDialog,
  args: {
    isOpen: true,
    onCancel: fn(),
    onSubmit: fn(wait),
    subject: "this tasting",
  },
  parameters: {
    docs: {
      description: {
        component:
          "Asks why content or a member is being reported. Any tasting, review, comment, or profile action menu opens it.",
      },
    },
  },
} satisfies Meta<typeof ReportDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Choosing a reason and sending calls onSubmit with the reason and note. */
export const SendsReasonAndNote: Story = {
  play: async ({ args }) => {
    await userEvent.selectOptions(
      await screen.findByLabelText("Reason"),
      "harassment",
    );
    await userEvent.type(screen.getByLabelText("Details"), "Targeted at me.");
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));
    await expect(args.onSubmit).toHaveBeenCalledWith({
      reason: "harassment",
      comment: "Targeted at me.",
    });
  },
};

/** The request fails; the dialog stays open with the error. */
export const RequestFails: Story = {
  args: {
    onSubmit: fn(async () => {
      await wait();
      throw new Error("Too many requests. Please try again later.");
    }),
  },
  play: async () => {
    await userEvent.click(
      await screen.findByRole("button", { name: "Send report" }),
    );
    await expect(
      await screen.findByText("Too many requests. Please try again later."),
    ).toBeInTheDocument();
  },
};
