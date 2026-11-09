import type { OAuthAuthorizationRequest } from "@peated/server/schemas";
import { getAccountStateRedirect } from "@peated/web/lib/auth";
import {
  oauthAuthorizationFormData,
  oauthAuthorizationSearchParams,
  oauthCallbackUrl,
} from "@peated/web/lib/oauth";
import { getAccountStateErrorCode } from "@peated/web/lib/orpc/link";

export type OAuthAuthorizationOperations = {
  authorize: (
    request: OAuthAuthorizationRequest,
  ) => Promise<{ code: string; redirectUri: string; state: string }>;
  validate: (
    request: OAuthAuthorizationRequest,
  ) => Promise<{ clientId: string; name: string }>;
  redirect: (url: string) => void;
  /** Re-reads the account from the API, clearing the session if it rejects the token. */
  refreshSession: () => Promise<Parameters<typeof getAccountStateRedirect>[0]>;
};

export async function approveOAuthAuthorizationWith(
  formData: FormData,
  operations: Pick<
    OAuthAuthorizationOperations,
    "authorize" | "redirect" | "refreshSession"
  >,
) {
  const parsed = oauthAuthorizationFormData(formData);
  if (!parsed.success) {
    throw new Error("Invalid authorization request.");
  }

  let result: Awaited<ReturnType<OAuthAuthorizationOperations["authorize"]>>;
  try {
    result = await operations.authorize(parsed.data);
  } catch (error) {
    // An expired, rejected, or suspended session signs in again (or goes to
    // the suspension screen) and comes back to this same request.
    if (!getAccountStateErrorCode(error)) throw error;
    const destination = getAccountStateRedirect(
      await operations.refreshSession(),
      {
        pathname: "/oauth/authorize",
        searchParams: oauthAuthorizationSearchParams(parsed.data),
      },
    );
    if (!destination) throw error;
    operations.redirect(destination);
    return;
  }

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
