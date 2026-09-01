import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSeriesPageLoader,
  type SeriesPageServices,
} from "./seriesPage.server";

type TestSeries = { id: number; fullName: string };

const series = { id: 421, fullName: "Dramfool Signature Collection" };
const loadSeries = vi.fn<SeriesPageServices<TestSeries>["loadSeries"]>();
const getRedirectPath =
  vi.fn<SeriesPageServices<TestSeries>["getRedirectPath"]>();
const redirect = vi.fn<SeriesPageServices<TestSeries>["redirect"]>();
const getSeriesPage = createSeriesPageLoader({
  loadSeries,
  getRedirectPath,
  redirect,
});
const redirectSignal = new Error("permanent redirect");

describe("getSeriesPage", () => {
  beforeEach(() => {
    loadSeries.mockReset();
    getRedirectPath.mockReset();
    redirect.mockReset();
    redirect.mockImplementation(() => {
      throw redirectSignal;
    });
  });

  it("returns an active Series at its canonical route", async () => {
    loadSeries.mockResolvedValue(series);
    getRedirectPath.mockResolvedValue(null);

    await expect(getSeriesPage(421)).resolves.toBe(series);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects a merged or stale Series route", async () => {
    const replacement = { ...series, id: 422 };
    loadSeries.mockResolvedValue(replacement);
    getRedirectPath.mockResolvedValue(
      "/series/422-dramfool-signature-collection?sort=name",
    );

    await expect(getSeriesPage(421)).rejects.toBe(redirectSignal);
    expect(getRedirectPath).toHaveBeenCalledWith({
      canonicalSeries: replacement,
      currentId: 421,
    });
    expect(redirect).toHaveBeenCalledWith(
      "/series/422-dramfool-signature-collection?sort=name",
    );
  });
});
