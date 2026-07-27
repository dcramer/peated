import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  details: vi.fn(),
  getAnonymousServerClient: vi.fn(),
  headers: vi.fn(),
  isORPCNotFoundError: vi.fn(),
  notFound: vi.fn(),
  permanentRedirect: vi.fn(),
}));

vi.mock("@peated/orpc/client/errors", () => ({
  isORPCNotFoundError: mocks.isORPCNotFoundError,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
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
const notFoundSignal = new Error("not found");

describe("getBottlePage", () => {
  beforeEach(() => {
    mocks.details.mockReset();
    mocks.getAnonymousServerClient.mockReset();
    mocks.headers.mockReset();
    mocks.isORPCNotFoundError.mockReset();
    mocks.notFound.mockReset();
    mocks.permanentRedirect.mockReset();

    mocks.getAnonymousServerClient.mockResolvedValue({
      client: {
        bottles: {
          details: mocks.details,
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
    mocks.notFound.mockImplementation(() => {
      throw notFoundSignal;
    });
  });

  it("returns an active independently complete Bottle", async () => {
    const bottle = { id: 11, fullName: "Lagavulin 16-year-old" };
    mocks.details.mockResolvedValue(bottle);

    await expect(getBottlePage(11)).resolves.toBe(bottle);

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
  });

  it("renders not found when the direct Bottle read returns typed not found", async () => {
    mocks.details.mockRejectedValue(typedNotFound);

    await expect(getBottlePage(11)).rejects.toBe(notFoundSignal);

    expect(mocks.isORPCNotFoundError).toHaveBeenCalledWith(typedNotFound);
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.permanentRedirect).not.toHaveBeenCalled();
  });

  it("preserves non-not-found detail errors", async () => {
    const error = new Error("upstream failure");
    mocks.details.mockRejectedValue(error);

    await expect(getBottlePage(11)).rejects.toBe(error);
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(mocks.permanentRedirect).not.toHaveBeenCalled();
  });
});
