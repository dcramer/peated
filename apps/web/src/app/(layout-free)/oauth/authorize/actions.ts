"use server";

import {
  oauthAuthorizationFormData,
  oauthCallbackUrl,
} from "@peated/web/lib/oauth";
import {
  createAnonymousServerClient,
  createServerClient,
} from "@peated/web/lib/orpc/client.server";
import { redirect } from "next/navigation";

export async function approveOAuthAuthorization(formData: FormData) {
  const parsed = oauthAuthorizationFormData(formData);
  if (!parsed.success) {
    throw new Error("Invalid authorization request.");
  }

  const { client } = await createServerClient();
  const result = await client.oauth.authorize(parsed.data);
  redirect(
    oauthCallbackUrl(result.redirectUri, {
      code: result.code,
      state: result.state,
    }),
  );
}

export async function denyOAuthAuthorization(formData: FormData) {
  const parsed = oauthAuthorizationFormData(formData);
  if (!parsed.success) {
    throw new Error("Invalid authorization request.");
  }

  const { client } = await createAnonymousServerClient();
  await client.oauth.authorizationDetails(parsed.data);
  redirect(
    oauthCallbackUrl(parsed.data.redirectUri, {
      error: "access_denied",
      state: parsed.data.state,
    }),
  );
}
