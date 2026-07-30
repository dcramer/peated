import { beforeEach, describe, expect, it, vi } from "vitest";

const { constructorMock, toBlobMock } = vi.hoisted(() => ({
  constructorMock: vi.fn(),
  toBlobMock: vi.fn(),
}));

vi.mock("pica", () => ({
  default: class PicaMock {
    constructor(options: unknown) {
      constructorMock(options);
    }

    toBlob = toBlobMock;
  },
}));

import { toBlob } from "./blobs";

beforeEach(() => {
  toBlobMock.mockResolvedValue(new Blob(["image"]));
});

describe("toBlob", () => {
  it("keeps Pica image processing off its generated web worker", async () => {
    const canvas = { width: 600, height: 600 } as HTMLCanvasElement;

    await toBlob(canvas);

    expect(constructorMock).toHaveBeenCalledWith({
      features: ["js", "wasm"],
    });
    expect(toBlobMock).toHaveBeenCalledWith(canvas, "image/webp", 0.9);
  });
});
