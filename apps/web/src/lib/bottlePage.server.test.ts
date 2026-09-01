import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBottlePageLoader,
  type BottlePageServices,
} from "./bottlePage.server";

type TestBottle = {
  id: number;
  name: string;
  brand: { name: string };
};

const bottle = {
  id: 11,
  name: "16-year-old",
  brand: { name: "Lagavulin" },
};

const loadBottle = vi.fn<BottlePageServices<TestBottle>["loadBottle"]>();
const getRedirectPath =
  vi.fn<BottlePageServices<TestBottle>["getRedirectPath"]>();
const redirect = vi.fn<BottlePageServices<TestBottle>["redirect"]>();
const getBottlePage = createBottlePageLoader({
  loadBottle,
  getRedirectPath,
  redirect,
});
const redirectSignal = new Error("permanent redirect");

describe("getBottlePage", () => {
  beforeEach(() => {
    loadBottle.mockReset();
    getRedirectPath.mockReset();
    redirect.mockReset();
    redirect.mockImplementation(() => {
      throw redirectSignal;
    });
  });

  it("returns an active independently complete Bottle", async () => {
    loadBottle.mockResolvedValue(bottle);
    getRedirectPath.mockResolvedValue(null);

    await expect(getBottlePage(11)).resolves.toBe(bottle);

    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects a merged Bottle with its suffix and query", async () => {
    const replacement = { ...bottle, id: 22 };
    loadBottle.mockResolvedValue(replacement);
    getRedirectPath.mockResolvedValue(
      "/bottles/22/tastings?source=legacy&tag=one&tag=two",
    );

    await expect(getBottlePage(11)).rejects.toBe(redirectSignal);

    expect(getRedirectPath).toHaveBeenCalledWith({
      canonicalBottle: replacement,
      currentId: 11,
    });
    expect(redirect).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith(
      "/bottles/22/tastings?source=legacy&tag=one&tag=two",
    );
  });

  it("preserves Bottle loader errors", async () => {
    const error = new Error("upstream failure");
    loadBottle.mockRejectedValue(error);

    await expect(getBottlePage(11)).rejects.toBe(error);
    expect(redirect).not.toHaveBeenCalled();
  });
});
