import waitError from "@peated/server/lib/test/waitError";
import type { LookupFunction } from "node:net";
import { vi } from "vitest";
import {
  createPublicAddressLookup,
  hasBlockedScraperLiteralAddress,
  isPublicScraperAddress,
  ScraperNetworkPolicyError,
} from "./networkPolicy";

test.each([
  "0.0.0.0",
  "10.1.2.3",
  "100.100.100.200",
  "127.0.0.1",
  "168.63.129.16",
  "169.254.169.254",
  "172.31.2.3",
  "192.168.1.1",
  "224.0.0.1",
  "255.255.255.255",
  "::",
  "::1",
  "::ffff:127.0.0.1",
  "fc00::1",
  "fd00:ec2::254",
  "fe80::1",
  "ff02::1",
])("rejects the non-public or reserved address %s", (address) => {
  expect(isPublicScraperAddress(address)).toBe(false);
});

test.each([
  "8.8.8.8",
  "93.184.216.34",
  "192.0.0.9",
  "2001:4860:4860::8888",
  "2606:2800:220:1:248:1893:25c8:1946",
])("allows the public address %s", (address) => {
  expect(isPublicScraperAddress(address)).toBe(true);
});

test.each([
  "http://127.0.0.1/metadata",
  "http://2130706433/metadata",
  "http://[::1]/metadata",
])("rejects the reserved literal URL %s", (url) => {
  expect(hasBlockedScraperLiteralAddress(new URL(url))).toBe(true);
});

function lookupResults(
  results: Array<{ address: string; family: 4 | 6 }>,
): LookupFunction {
  return vi.fn((_hostname, _options, callback) => {
    callback(null, results);
  });
}

function runLookup(lookup: LookupFunction) {
  return new Promise<void>((resolve, reject) => {
    lookup("publisher.example", { all: true }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

test("allows DNS only when every address returned to the socket is public", async () => {
  await expect(
    runLookup(
      createPublicAddressLookup(
        lookupResults([
          { address: "93.184.216.34", family: 4 },
          { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
        ]),
      ),
    ),
  ).resolves.toBeUndefined();

  await waitError(
    runLookup(
      createPublicAddressLookup(
        lookupResults([
          { address: "93.184.216.34", family: 4 },
          { address: "127.0.0.1", family: 4 },
        ]),
      ),
    ),
    ScraperNetworkPolicyError,
  );
});
