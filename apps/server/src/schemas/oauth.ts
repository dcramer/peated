import { parseRegisteredRedirectUri } from "@peated/server/lib/oauth";
import { z } from "zod";

export const OAuthRedirectUriSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (!parseRegisteredRedirectUri(value)) {
      ctx.addIssue({
        code: "custom",
        message:
          "Use an HTTPS URL or an HTTP loopback IP URL without userinfo, wildcards, or fragments.",
      });
    }
  });

export const OAuthClientSchema = z.object({
  id: z.number(),
  clientId: z.string(),
  name: z.string(),
  redirectUris: z.array(z.string()),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const OAuthClientInputSchema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  redirectUris: z
    .array(OAuthRedirectUriSchema)
    .min(1, "Add at least one redirect URI.")
    .max(20)
    .transform((values) => [...new Set(values)]),
});

export const OAuthAuthorizationRequestSchema = z.object({
  responseType: z.literal("code"),
  clientId: z.string().min(1),
  redirectUri: z.string().min(1),
  state: z.string().min(1).max(2048),
  codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  codeChallengeMethod: z.literal("S256"),
});

export const OAuthAuthorizationQuerySchema = z
  .object({
    response_type: z.literal("code"),
    client_id: z.string().min(1),
    redirect_uri: z.string().min(1),
    state: z.string().min(1).max(2048),
    code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    code_challenge_method: z.literal("S256"),
  })
  .transform((value) => ({
    responseType: value.response_type,
    clientId: value.client_id,
    redirectUri: value.redirect_uri,
    state: value.state,
    codeChallenge: value.code_challenge,
    codeChallengeMethod: value.code_challenge_method,
  }))
  .pipe(OAuthAuthorizationRequestSchema);

export const OAuthAuthorizationClientSchema = z.object({
  clientId: z.string(),
  name: z.string(),
});

export const OAuthAuthorizationCodeSchema = z.object({
  code: z.string(),
  redirectUri: z.string(),
  state: z.string(),
});

export const OAuthGrantTypeSchema = z.string().min(1);

export const OAuthTokenRequestSchema = z.object({
  grant_type: OAuthGrantTypeSchema,
  code: z.string().min(1),
  client_id: z.string().min(1),
  redirect_uri: z.string().min(1),
  code_verifier: z.string().min(1),
});

export type OAuthAuthorizationRequest = z.infer<
  typeof OAuthAuthorizationRequestSchema
>;
export type OAuthTokenRequest = z.infer<typeof OAuthTokenRequestSchema>;
