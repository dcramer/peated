import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadImageAfterSave } from "./imageUpload";

afterEach(() => {
  vi.useRealTimers();
});

describe("uploadImageAfterSave", () => {
  it("uploads the prepared image", async () => {
    const file = new Blob(["image"]);
    const upload = vi.fn().mockResolvedValue(undefined);

    await uploadImageAfterSave({
      prepare: async () => file,
      upload,
    });

    expect(upload).toHaveBeenCalledWith(file);
  });

  it("reports image preparation failures", async () => {
    const error = new Error("Could not convert canvas");

    await expect(
      uploadImageAfterSave({
        prepare: async () => {
          throw error;
        },
        upload: vi.fn(),
      }),
    ).rejects.toBe(error);
  });

  it("times out an image upload that never settles", async () => {
    vi.useFakeTimers();
    const result = uploadImageAfterSave({
      prepare: async () => new Blob(["image"]),
      upload: async () => await new Promise(() => {}),
      timeoutMs: 100,
    });
    const expectation = expect(result).rejects.toThrow(
      "Image upload timed out.",
    );

    await vi.advanceTimersByTimeAsync(100);

    await expectation;
  });

  it("identifies image preparation timeouts", async () => {
    vi.useFakeTimers();
    const result = uploadImageAfterSave({
      prepare: async () => await new Promise(() => {}),
      upload: vi.fn(),
      timeoutMs: 100,
    });
    const expectation = expect(result).rejects.toThrow(
      "Image preparation timed out.",
    );

    await vi.advanceTimersByTimeAsync(100);

    await expectation;
  });
});
