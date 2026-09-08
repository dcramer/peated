import {
  component,
  createSignature,
  type FieldOccurrence,
  type ResponseDescriptor,
} from "http-message-sig";
import { generateNonce } from "web-bot-auth";
import { signerFromJWK } from "web-bot-auth/crypto";
import { z } from "zod";

const CACHE_CONTROL = "public, max-age=86400";
const CONTENT_TYPE = "application/http-message-signatures-directory+json";
const DIRECTORY_SIGNATURE_TAG = "http-message-signatures-directory";
const SIGNATURE_LIFETIME_SECONDS = 60;

export const runtime = "nodejs";

const PrivateJwkSchema = z
  .object({
    kty: z.literal("OKP"),
    crv: z.literal("Ed25519"),
    alg: z.literal("EdDSA").optional(),
    x: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    d: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strip();

function parsePrivateJwk(configuredKey: string) {
  let value: unknown;
  try {
    value = JSON.parse(configuredKey);
  } catch {
    // Sensitive-data policy: JSON parse errors can quote the private key, so do
    // not preserve the parser error as the cause.
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

function responseFields(headers: Headers): FieldOccurrence[] {
  return Array.from(headers, ([name, value]) => ({ name, value }));
}

export async function GET(request: Request) {
  const configuredKey = process.env.PEATED_BOT_PRIVATE_JWK?.trim();
  if (!configuredKey) {
    return new Response("PeatedBot signing is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const privateJwk = parsePrivateJwk(configuredKey);
  // Cloudflare directory contract: publish only public JWK fields. The `d`
  // field is the private key and must never leave the deployment secret.
  const publicJwk = {
    kty: "OKP",
    crv: "Ed25519",
    x: privateJwk.x,
  };
  const body = JSON.stringify({ keys: [publicJwk] });
  const headers = new Headers({
    "Cache-Control": CACHE_CONTROL,
    "Content-Type": CONTENT_TYPE,
  });
  const signer = await signerFromJWK(privateJwk);
  const created = Math.floor(Date.now() / 1_000);
  const response: ResponseDescriptor = {
    kind: "response",
    status: 200,
    fields: responseFields(headers),
    request,
  };
  const signature = await createSignature(response, {
    label: "sig1",
    components: [component("@authority", { req: true })],
    parameters: {
      alg: "ed25519",
      keyid: signer.keyid,
      nonce: generateNonce(),
      tag: DIRECTORY_SIGNATURE_TAG,
      created,
      expires: created + SIGNATURE_LIFETIME_SECONDS,
    },
    signer,
  });
  headers.set("Signature", signature.signature);
  headers.set("Signature-Input", signature.signatureInput);

  return new Response(body, { headers });
}
