import config from "@peated/server/config";
import { generateNonce, sign, type WebBotSigner } from "web-bot-auth";
import { signerFromJWK } from "web-bot-auth/crypto";
import { z } from "zod";

const SIGNATURE_AGENT = '"https://peated.com"';
const SIGNATURE_LIFETIME_MS = 60_000;

let cachedSigner:
  | { configuredKey: string; signer: Promise<WebBotSigner> }
  | undefined;

const PrivateJwkSchema = z
  .object({
    kty: z.literal("OKP"),
    crv: z.literal("Ed25519"),
    alg: z.literal("EdDSA").optional(),
    x: z.string().min(1),
    d: z.string().min(1),
  })
  .passthrough();

function parsePrivateJwk(configuredKey: string) {
  let value: unknown;
  try {
    value = JSON.parse(configuredKey);
  } catch {
    throw new Error("PEATED_BOT_PRIVATE_JWK must be valid JSON.");
  }

  const parsed = PrivateJwkSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      "PEATED_BOT_PRIVATE_JWK must contain a private Ed25519 JWK.",
    );
  }

  return parsed.data;
}

function getSigner(configuredKey: string) {
  if (cachedSigner?.configuredKey !== configuredKey) {
    cachedSigner = {
      configuredKey,
      signer: signerFromJWK(parsePrivateJwk(configuredKey)),
    };
  }
  return cachedSigner.signer;
}

export async function signScraperRequest(
  url: URL,
  headers: Readonly<Record<string, string>>,
  created: Date,
) {
  const configuredKey = config.PEATED_BOT_PRIVATE_JWK;
  if (!configuredKey) return new Headers(headers);

  const signer = await getSigner(configuredKey);
  const signedHeaders = new Headers(headers);
  signedHeaders.set("Signature-Agent", SIGNATURE_AGENT);
  const fields = await sign(new Request(url, { headers: signedHeaders }), {
    signer,
    created,
    expires: new Date(created.getTime() + SIGNATURE_LIFETIME_MS),
    nonce: generateNonce(),
  });
  signedHeaders.set("Signature", fields.signature);
  signedHeaders.set("Signature-Input", fields.signatureInput);
  return signedHeaders;
}
