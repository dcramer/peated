// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EntityImageEditor,
  type EntityImageDraft,
} from "./entityImageEditor.stylex";

const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(
  URL,
  "createObjectURL",
);
const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(
  URL,
  "revokeObjectURL",
);

function EntityImageEditorHarness() {
  const [images, setImages] = useState<EntityImageDraft[]>([]);
  return (
    <EntityImageEditor disabled={false} images={images} onChange={setImages} />
  );
}

describe("EntityImageEditor", () => {
  let container: HTMLDivElement;
  let root: Root | null;
  const createObjectURL = vi.fn();
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    createObjectURL.mockReset();
    revokeObjectURL.mockReset();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    if (createObjectUrlDescriptor) {
      Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
    } else {
      Reflect.deleteProperty(URL, "createObjectURL");
    }
    if (revokeObjectUrlDescriptor) {
      Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
    } else {
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });

  function addFile(file: File) {
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    });
    act(() => {
      input?.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("releases local previews when they are removed or the editor unmounts", () => {
    createObjectURL
      .mockReturnValueOnce("blob:removed")
      .mockReturnValueOnce("blob:unmounted");
    act(() => root?.render(<EntityImageEditorHarness />));

    addFile(new File(["first"], "first.jpg", { type: "image/jpeg" }));
    const removeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Remove",
    );
    act(() => removeButton?.click());
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:removed");

    addFile(new File(["second"], "second.jpg", { type: "image/jpeg" }));
    act(() => root?.unmount());
    root = null;
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:unmounted");
  });
});
