import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBottlePageLoader,
  type BottlePageServices,
} from "./bottlePage.server";

type TestBottle = { id: number; fullName?: string };

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
    const bottle = { id: 11, fullName: "Lagavulin 16-year-old" };
    loadBottle.mockResolvedValue(bottle);

    await expect(getBottlePage(11)).resolves.toBe(bottle);

    expect(redirect).not.toHaveBeenCalled();
  });

  it("permanently redirects an exact replacement with its suffix and query", async () => {
    loadBottle.mockResolvedValue({ id: 22 });
    getRedirectPath.mockResolvedValue(
      "/bottles/22/tastings?source=legacy&tag=one&tag=two",
    );

    await expect(getBottlePage(11)).rejects.toBe(redirectSignal);

    expect(getRedirectPath).toHaveBeenCalledWith({
      canonicalId: 22,
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
