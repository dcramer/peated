import type { OAuthAuthorizationRequest } from "@peated/server/schemas";
import {
  oauthAuthorizationFormData,
  oauthCallbackUrl,
} from "@peated/web/lib/oauth";

export type OAuthAuthorizationOperations = {
  authorize: (
    request: OAuthAuthorizationRequest,
  ) => Promise<{ code: string; redirectUri: string; state: string }>;
  validate: (
    request: OAuthAuthorizationRequest,
  ) => Promise<{ clientId: string; name: string }>;
  redirect: (url: string) => void;
};

export async function approveOAuthAuthorizationWith(
  formData: FormData,
  operations: Pick<OAuthAuthorizationOperations, "authorize" | "redirect">,
) {
  const parsed = oauthAuthorizationFormData(formData);
  if (!parsed.success) {
    throw new Error("Invalid authorization request.");
  }

  const result = await operations.authorize(parsed.data);
  operations.redirect(
    oauthCallbackUrl(result.redirectUri, {
      code: result.code,
      state: result.state,
    }),
  );
}

export async function denyOAuthAuthorizationWith(
  formData: FormData,
  operations: Pick<OAuthAuthorizationOperations, "validate" | "redirect">,
) {
  const parsed = oauthAuthorizationFormData(formData);
  if (!parsed.success) {
    throw new Error("Invalid authorization request.");
  }

  await operations.validate(parsed.data);
  operations.redirect(
    oauthCallbackUrl(parsed.data.redirectUri, {
      error: "access_denied",
      state: parsed.data.state,
    }),
  );
}
