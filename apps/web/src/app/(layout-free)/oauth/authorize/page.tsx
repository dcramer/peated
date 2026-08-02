import Alert from "@peated/web/components/alert";
import LayoutSplash from "@peated/web/components/layoutSplash";
import { redirectToAuth } from "@peated/web/lib/auth";
import {
  oauthAuthorizationSearchParams,
  parseOAuthAuthorizationQuery,
} from "@peated/web/lib/oauth";
import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { getSession } from "@peated/web/lib/session.server";
import type { Metadata } from "next";
import AuthorizationForm from "./authorizationForm";

export const metadata: Metadata = {
  title: "Authorize Application",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

function InvalidAuthorizationRequest() {
  return (
    <LayoutSplash>
      <div className="mb-8">
        <h1 className="mb-4 text-2xl font-semibold">
          Invalid authorization request
        </h1>
        <Alert noMargin>
          This application supplied an unknown client, unsafe redirect, or
          invalid PKCE request. Return to the application and try again.
        </Alert>
      </div>
    </LayoutSplash>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const parsed = parseOAuthAuthorizationQuery(await searchParams);
  if (!parsed.success) return <InvalidAuthorizationRequest />;

  let clientDetails: { clientId: string; name: string };
  try {
    const { client } = await createAnonymousServerClient();
    clientDetails = await client.oauth.authorizationDetails(parsed.data);
  } catch {
    return <InvalidAuthorizationRequest />;
  }

  const session = await getSession();
  if (!session.user) {
    return redirectToAuth({
      pathname: "/oauth/authorize",
      searchParams: oauthAuthorizationSearchParams(parsed.data),
    });
  }

  return (
    <LayoutSplash>
      <div className="mb-8">
        <div className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
          Application Access
        </div>
        <h1 className="mb-4 text-2xl font-semibold">
          Authorize {clientDetails.name}?
        </h1>
        <p className="text-muted mb-4">
          This application will receive API access as @{session.user.username}.
        </p>
        <Alert type="default" noMargin>
          It can perform the same Peated API actions your account can. Peated
          does not share your password or sign-in credentials.
        </Alert>
      </div>
      <AuthorizationForm request={parsed.data} />
    </LayoutSplash>
  );
}
