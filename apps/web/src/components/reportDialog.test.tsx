// @vitest-environment jsdom

import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  findButton,
  findByLabel,
  flush,
  mountDialog,
  selectOption,
  typeInto,
} from "./dialogTestHarness";
import { ReportDialog } from "./reportDialog";

describe("ReportDialog", () => {
  let dialog: ReturnType<typeof mountDialog> | null = null;

  afterEach(() => {
    dialog?.unmount();
    dialog = null;
  });

  it("submits the chosen reason and trimmed details", async () => {
    const onSubmit = vi.fn(async () => undefined);
    dialog = mountDialog();
    act(() =>
      dialog?.root.render(
        <ReportDialog
          isOpen
          onCancel={() => undefined}
          onSubmit={onSubmit}
          subject="this tasting"
        />,
      ),
    );

    selectOption(findByLabel<HTMLSelectElement>("Reason"), "harassment");
    typeInto(findByLabel<HTMLTextAreaElement>("Details"), "  Targeted at me. ");
    act(() => findButton("Send report").click());
    await flush();

    expect(onSubmit).toHaveBeenCalledWith({
      reason: "harassment",
      comment: "Targeted at me.",
    });
  });

  it("omits empty details and keeps the dialog open on failure", async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error("Too many requests. Please try again later.");
    });
    dialog = mountDialog();
    act(() =>
      dialog?.root.render(
        <ReportDialog
          isOpen
          onCancel={() => undefined}
          onSubmit={onSubmit}
          subject="this comment"
        />,
      ),
    );

    act(() => findButton("Send report").click());
    await flush();

    expect(onSubmit).toHaveBeenCalledWith({
      reason: "spam",
      comment: undefined,
    });
    expect(document.body.textContent).toContain(
      "Too many requests. Please try again later.",
    );
    expect(findButton("Send report").disabled).toBe(false);
  });
});
