import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bottleGroupDetails: vi.fn(),
  details: vi.fn(),
  getAnonymousServerClient: vi.fn(),
  headers: vi.fn(),
  isORPCNotFoundError: vi.fn(),
  pageTarget: vi.fn(),
  permanentRedirect: vi.fn(),
}));

vi.mock("@peated/orpc/client/errors", () => ({
  isORPCNotFoundError: mocks.isORPCNotFoundError,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  permanentRedirect: mocks.permanentRedirect,
}));

vi.mock("react", () => ({
  cache: <Args extends unknown[], Result>(
    callback: (...args: Args) => Result,
  ) => callback,
}));

vi.mock("./orpc/client.server", () => ({
  getAnonymousServerClient: mocks.getAnonymousServerClient,
}));

import { getBottlePage } from "./bottlePage.server";

const redirectSignal = new Error("permanent redirect");
const typedNotFound = new Error("typed not found");

describe("getBottlePage", () => {
  beforeEach(() => {
    mocks.details.mockReset();
    mocks.bottleGroupDetails.mockReset();
    mocks.getAnonymousServerClient.mockReset();
    mocks.headers.mockReset();
    mocks.isORPCNotFoundError.mockReset();
    mocks.pageTarget.mockReset();
    mocks.permanentRedirect.mockReset();

    mocks.getAnonymousServerClient.mockResolvedValue({
      client: {
        bottles: {
          details: mocks.details,
          pageTarget: mocks.pageTarget,
        },
        bottleGroups: {
          details: mocks.bottleGroupDetails,
        },
      },
    });
    mocks.headers.mockResolvedValue(new Headers());
    mocks.isORPCNotFoundError.mockImplementation(
      (error) => error === typedNotFound,
    );
    mocks.permanentRedirect.mockImplementation(() => {
      throw redirectSignal;
    });
  });

  it("returns an active exact Bottle without resolving a page target", async () => {
    const bottle = { id: 11, fullName: "Lagavulin 16-year-old" };
    mocks.details.mockResolvedValue(bottle);

    await expect(getBottlePage(11)).resolves.toBe(bottle);

    expect(mocks.pageTarget).not.toHaveBeenCalled();
    expect(mocks.permanentRedirect).not.toHaveBeenCalled();
  });

  it("permanently redirects an exact replacement with its suffix and query", async () => {
    mocks.details.mockResolvedValue({ id: 22 });
    mocks.headers.mockResolvedValue(
      new Headers({
        "x-peated-request-path":
          "/bottles/11/tastings?source=legacy&tag=one&tag=two",
      }),
    );

    await expect(getBottlePage(11)).rejects.toBe(redirectSignal);

    expect(mocks.permanentRedirect).toHaveBeenCalledOnce();
    expect(mocks.permanentRedirect).toHaveBeenCalledWith(
      "/bottles/22/tastings?source=legacy&tag=one&tag=two",
    );
    expect(mocks.pageTarget).not.toHaveBeenCalled();
  });

  it("redirects a retired parent through its generic family route anchor", async () => {
    mocks.details.mockRejectedValue(typedNotFound);
    mocks.pageTarget.mockResolvedValue({ kind: "group", groupId: 33 });
    mocks.bottleGroupDetails.mockResolvedValue({
      group: { id: 33, representativeBottleId: 44 },
    });
    mocks.headers.mockResolvedValue(
      new Headers({
        "x-peated-request-path":
          "/bottles/11/tastings?source=legacy&tag=one&tag=two",
      }),
    );

    await expect(getBottlePage(11)).rejects.toBe(redirectSignal);

    expect(mocks.isORPCNotFoundError).toHaveBeenCalledWith(typedNotFound);
    expect(mocks.pageTarget).toHaveBeenCalledOnce();
    expect(mocks.pageTarget).toHaveBeenCalledWith({ bottle: 11 });
    expect(mocks.bottleGroupDetails).toHaveBeenCalledWith({ group: 33 });
    expect(mocks.permanentRedirect).toHaveBeenCalledOnce();
    expect(mocks.permanentRedirect).toHaveBeenCalledWith(
      "/bottles/44/releases?source=legacy&tag=one&tag=two",
    );
  });

  it("fails closed when a retired parent's group has no active route anchor", async () => {
    mocks.details.mockRejectedValue(typedNotFound);
    mocks.pageTarget.mockResolvedValue({ kind: "group", groupId: 33 });
    mocks.bottleGroupDetails.mockResolvedValue({
      group: { id: 33, representativeBottleId: null },
    });

    await expect(getBottlePage(11)).rejects.toThrow(
      "Active release family 33 has no valid representative Bottle",
    );
    expect(mocks.permanentRedirect).not.toHaveBeenCalled();
  });
});
