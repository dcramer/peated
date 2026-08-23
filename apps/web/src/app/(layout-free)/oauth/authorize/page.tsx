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
import type { ReactNode } from "react";
import AuthorizationForm from "./authorizationForm";

export const metadata: Metadata = {
  title: "Authorize Application",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

export type OAuthAuthorizationPageServices = {
  loadClientDetails: (request: {
    clientId: string;
    codeChallenge: string;
    codeChallengeMethod: "S256";
    redirectUri: string;
    responseType: "code";
    state: string;
  }) => Promise<{ clientId: string; name: string }>;
  loadSessionUser: () => Promise<{ username: string } | null>;
  redirectToLogin: (options: {
    pathname: string;
    searchParams: URLSearchParams;
  }) => ReactNode;
  renderForm: (
    request: Parameters<typeof AuthorizationForm>[0]["request"],
  ) => ReactNode;
  renderLayout: (children: ReactNode) => ReactNode;
};

const pageServices: OAuthAuthorizationPageServices = {
  async loadClientDetails(request) {
    const { client } = await createAnonymousServerClient();
    return await client.oauth.authorizationDetails(request);
  },
  async loadSessionUser() {
    return (await getSession()).user;
  },
  redirectToLogin: redirectToAuth,
  renderForm: (request) => <AuthorizationForm request={request} />,
  renderLayout: (children) => <LayoutSplash>{children}</LayoutSplash>,
};

function InvalidAuthorizationRequest({
  renderLayout,
}: Pick<OAuthAuthorizationPageServices, "renderLayout">) {
  return renderLayout(
    <>
      <div className="mb-8">
        <h1 className="mb-4 text-2xl font-semibold">
          Invalid authorization request
        </h1>
        <Alert noMargin>
          This application supplied an unknown client, unsafe redirect, or
          invalid PKCE request. Return to the application and try again.
        </Alert>
      </div>
    </>,
  );
}

export function createOAuthAuthorizationPage(
  services: OAuthAuthorizationPageServices,
) {
  return async function OAuthAuthorizationPage({
    searchParams,
  }: {
    searchParams: Promise<SearchParams>;
  }) {
    const parsed = parseOAuthAuthorizationQuery(await searchParams);
    if (!parsed.success) {
      return <InvalidAuthorizationRequest {...services} />;
    }

    let clientDetails: { clientId: string; name: string };
    try {
      clientDetails = await services.loadClientDetails(parsed.data);
    } catch {
      return <InvalidAuthorizationRequest {...services} />;
    }

    const user = await services.loadSessionUser();
    if (!user) {
      return services.redirectToLogin({
        pathname: "/oauth/authorize",
        searchParams: oauthAuthorizationSearchParams(parsed.data),
      });
    }

    return services.renderLayout(
      <>
        <div className="mb-8">
          <div className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
            Application Access
          </div>
          <h1 className="mb-4 text-2xl font-semibold">
            Authorize {clientDetails.name}?
          </h1>
          <p className="text-muted mb-4">
            This application will receive API access as @{user.username}.
          </p>
          <Alert type="default" noMargin>
            It can perform the same Peated API actions your account can. Peated
            does not share your password or sign-in credentials.
          </Alert>
        </div>
        {services.renderForm(parsed.data)}
      </>,
    );
  };
}

export default createOAuthAuthorizationPage(pageServices);
