import {
  OAuthAuthorizationQuerySchema,
  type OAuthAuthorizationRequest,
} from "@peated/server/schemas";

export function parseOAuthAuthorizationQuery(input: unknown) {
  return OAuthAuthorizationQuerySchema.safeParse(input);
}

export function oauthAuthorizationSearchParams(
  request: OAuthAuthorizationRequest,
): URLSearchParams {
  return new URLSearchParams({
    response_type: request.responseType,
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    state: request.state,
    code_challenge: request.codeChallenge,
    code_challenge_method: request.codeChallengeMethod,
  });
}

export function oauthAuthorizationFormData(formData: FormData) {
  return parseOAuthAuthorizationQuery({
    response_type: formData.get("response_type"),
    client_id: formData.get("client_id"),
    redirect_uri: formData.get("redirect_uri"),
    state: formData.get("state"),
    code_challenge: formData.get("code_challenge"),
    code_challenge_method: formData.get("code_challenge_method"),
  });
}

export function oauthCallbackUrl(
  redirectUri: string,
  values: Record<string, string>,
): string {
  const fragmentIndex = redirectUri.indexOf("#");
  const base =
    fragmentIndex === -1 ? redirectUri : redirectUri.slice(0, fragmentIndex);
  const fragment = fragmentIndex === -1 ? "" : redirectUri.slice(fragmentIndex);
  const separator = base.includes("?")
    ? base.endsWith("?") || base.endsWith("&")
      ? ""
      : "&"
    : "?";

  // Preserve the registered URI's query bytes when adding response fields.
  return `${base}${separator}${new URLSearchParams(values)}${fragment}`;
}
