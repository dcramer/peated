// @vitest-environment jsdom

import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  findButton,
  findByLabel,
  flush,
  mountDialog,
  typeInto,
} from "./dialogTestHarness";
import { SuspendMemberDialog } from "./suspendMemberDialog";

describe("SuspendMemberDialog", () => {
  let dialog: ReturnType<typeof mountDialog> | null = null;

  afterEach(() => {
    dialog?.unmount();
    dialog = null;
  });

  it("requires a reason before suspending", async () => {
    const onSubmit = vi.fn(async () => undefined);
    dialog = mountDialog();
    act(() =>
      dialog?.root.render(
        <SuspendMemberDialog
          isOpen
          onCancel={() => undefined}
          onSubmit={onSubmit}
          username="islaydrinker"
        />,
      ),
    );

    act(() => findButton("Suspend member").click());
    await flush();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("A reason is required.");

    typeInto(findByLabel<HTMLTextAreaElement>("Reason"), " Repeated spam. ");
    act(() => findButton("Suspend member").click());
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("Repeated spam.");
  });
});
