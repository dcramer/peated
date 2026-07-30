import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadTastingImageAfterSave } from "./tastingImageUpload";

afterEach(() => {
  vi.useRealTimers();
});

describe("uploadTastingImageAfterSave", () => {
  it("uploads the prepared image", async () => {
    const file = new Blob(["image"]);
    const upload = vi.fn().mockResolvedValue(undefined);

    await uploadTastingImageAfterSave({
      prepare: async () => file,
      upload,
    });

    expect(upload).toHaveBeenCalledWith(file);
  });

  it("reports image preparation failures", async () => {
    const error = new Error("Could not convert canvas");

    await expect(
      uploadTastingImageAfterSave({
        prepare: async () => {
          throw error;
        },
        upload: vi.fn(),
      }),
    ).rejects.toBe(error);
  });

  it("times out an image upload that never settles", async () => {
    vi.useFakeTimers();
    const result = uploadTastingImageAfterSave({
      prepare: async () => new Blob(["image"]),
      upload: async () => await new Promise(() => {}),
      timeoutMs: 100,
    });
    const expectation = expect(result).rejects.toThrow(
      "Tasting image upload timed out.",
    );

    await vi.advanceTimersByTimeAsync(100);

    await expectation;
  });

  it("identifies image preparation timeouts", async () => {
    vi.useFakeTimers();
    const result = uploadTastingImageAfterSave({
      prepare: async () => await new Promise(() => {}),
      upload: vi.fn(),
      timeoutMs: 100,
    });
    const expectation = expect(result).rejects.toThrow(
      "Tasting image preparation timed out.",
    );

    await vi.advanceTimersByTimeAsync(100);

    await expectation;
  });
});
