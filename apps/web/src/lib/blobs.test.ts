// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { type CreateImageProcessor, toBlob } from "./blobs";

const resizeMock = vi.fn();
const toBlobMock = vi.fn();
const createProcessor: CreateImageProcessor = () => ({
  resize: resizeMock,
  toBlob: toBlobMock,
});

beforeEach(() => {
  resizeMock.mockReset();
  toBlobMock.mockReset();
  toBlobMock.mockResolvedValue(new Blob(["image"]));
});

describe("toBlob", () => {
  it("encodes images that do not need resizing", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;

    await toBlob(canvas, createProcessor);

    expect(toBlobMock).toHaveBeenCalledWith(canvas, "image/webp", 0.9);
  });
});
