"use server";

import {
  createAnonymousServerClient,
  createServerClient,
} from "@peated/web/lib/orpc/client.server";
import { redirect } from "next/navigation";
import {
  approveOAuthAuthorizationWith,
  denyOAuthAuthorizationWith,
} from "./authorizationOperations";

export async function approveOAuthAuthorization(formData: FormData) {
  const { client } = await createServerClient();
  await approveOAuthAuthorizationWith(formData, {
    authorize: client.oauth.authorize,
    redirect,
  });
}

export async function denyOAuthAuthorization(formData: FormData) {
  const { client } = await createAnonymousServerClient();
  await denyOAuthAuthorizationWith(formData, {
    validate: client.oauth.authorizationDetails,
    redirect,
  });
}
