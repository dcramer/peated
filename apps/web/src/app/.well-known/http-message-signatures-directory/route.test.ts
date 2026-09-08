import {
  component,
  verifySignature,
  type ResponseDescriptor,
} from "http-message-sig";
import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifierFromJWK } from "web-bot-auth/crypto";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("HTTP message signature directory", () => {
  it("does not publish a directory without a configured private key", async () => {
    vi.stubEnv("PEATED_BOT_PRIVATE_JWK", "");

    const response = await GET(
      new Request(
        "https://peated.com/.well-known/http-message-signatures-directory",
      ),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("publishes only the public key in a signed directory", async () => {
    const { privateKey } = generateKeyPairSync("ed25519");
    const privateJwk = privateKey.export({ format: "jwk" });
    vi.stubEnv("PEATED_BOT_PRIVATE_JWK", JSON.stringify(privateJwk));
    const request = new Request(
      "https://peated.com/.well-known/http-message-signatures-directory",
    );
    const response = await GET(request);
    const directory = await response.clone().json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/http-message-signatures-directory+json",
    );
    expect(directory).toEqual({
      keys: [
        {
          kty: "OKP",
          crv: "Ed25519",
          x: privateJwk.x,
        },
      ],
    });
    expect(directory.keys[0]).not.toHaveProperty("d");

    const verifier = await verifierFromJWK(privateJwk);
    const descriptor: ResponseDescriptor = {
      kind: "response",
      status: response.status,
      fields: Array.from(response.headers, ([name, value]) => ({
        name,
        value,
      })),
      request,
    };
    const verified = await verifySignature(descriptor, {
      policy: {
        algorithms: ["ed25519"],
        requiredComponents: [component("@authority", { req: true })],
        requiredParameters: [
          "alg",
          "keyid",
          "nonce",
          "tag",
          "created",
          "expires",
        ],
      },
      resolveVerifier: () => verifier,
    });

    expect(verified.parameters).toMatchObject({
      alg: "ed25519",
      keyid: verifier.keyid,
      tag: "http-message-signatures-directory",
    });
  });
});
