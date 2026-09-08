import { lookup as systemLookup } from "node:dns";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { Agent } from "undici";

const blockedAddresses = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["100:0:0:1::", 64],
  ["2001::", 32],
  ["2001:2::", 48],
  ["2001:10::", 28],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
  ["5f00::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv6");
}

// Crawler HTTP treats Azure's host-local platform address as metadata, even
// though Azure assigns it from public IPv4 space.
blockedAddresses.addAddress("168.63.129.16", "ipv4");

const publicProtocolAddresses = new BlockList();
for (const address of ["192.0.0.9", "192.0.0.10"] as const) {
  publicProtocolAddresses.addAddress(address, "ipv4");
}

const publicIpv6Addresses = new BlockList();
publicIpv6Addresses.addSubnet("2000::", 3, "ipv6");

export class ScraperNetworkPolicyError extends Error {
  override name = "ScraperNetworkPolicyError";

  constructor() {
    super("Scraper requests require a public network destination.");
  }
}

export function isPublicScraperAddress(address: string) {
  const family = isIP(address);
  if (family === 4) {
    if (publicProtocolAddresses.check(address, "ipv4")) return true;
    return !blockedAddresses.check(address, "ipv4");
  }
  if (family === 6) {
    return (
      publicIpv6Addresses.check(address, "ipv6") &&
      !blockedAddresses.check(address, "ipv6")
    );
  }
  return false;
}

export function hasBlockedScraperLiteralAddress(url: URL) {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  return isIP(hostname) !== 0 && !isPublicScraperAddress(hostname);
}

/** Validates every DNS result before the socket can select an address. */
export function createPublicAddressLookup(
  lookupImpl: LookupFunction = systemLookup,
): LookupFunction {
  return (hostname, options, callback) => {
    lookupImpl(hostname, options, (error, address, family) => {
      if (error) {
        callback(error, address, family);
        return;
      }
      const results = Array.isArray(address)
        ? address
        : [{ address, family: family ?? isIP(address) }];
      if (
        results.length === 0 ||
        results.some((result) => !isPublicScraperAddress(result.address))
      ) {
        callback(new ScraperNetworkPolicyError(), address, family);
        return;
      }
      callback(null, address, family);
    });
  };
}

/** Checks an error's cause chain for a crawler network rejection. */
export function isScraperNetworkPolicyError(error: Error) {
  let current: Error | undefined = error;
  const visited = new Set<Error>();
  while (current && !visited.has(current)) {
    if (current instanceof ScraperNetworkPolicyError) return true;
    visited.add(current);
    current = current.cause instanceof Error ? current.cause : undefined;
  }
  return false;
}

// Crawler transport owns the public-destination rule: every new socket checks
// the DNS result it will use, including sockets opened after redirects.
const scraperDispatcher = new Agent({
  autoSelectFamily: true,
  connect: { lookup: createPublicAddressLookup() },
});

/** Fetches through the crawler-owned dispatcher that validates socket addresses. */
export const fetchScraperUrl: typeof fetch = async (input, init) => {
  const requestInit: RequestInit = {
    ...init,
  };
  // Node fetch accepts Undici's dispatcher at runtime, but Node and the direct
  // dependency expose separate copies of its type.
  Object.assign(requestInit, { dispatcher: scraperDispatcher });
  return fetch(input, requestInit);
};
