import { AuthenticationPage } from "@peated/web/components/auth/authenticationPage.stylex";
import {
  AuthenticationNotice,
  AuthenticationPanel,
} from "@peated/web/components/designSystem/patterns/authentication.stylex";
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
  renderLayout: (children) => (
    <AuthenticationPage intro="database">{children}</AuthenticationPage>
  ),
};

function InvalidAuthorizationRequest({
  renderLayout,
}: Pick<OAuthAuthorizationPageServices, "renderLayout">) {
  return renderLayout(
    <AuthenticationPanel
      description="The requesting application supplied an unknown client, unsafe redirect, or invalid security challenge."
      title="Invalid authorization request"
    >
      <AuthenticationNotice>
        Return to the application that sent you here and try again.
      </AuthenticationNotice>
    </AuthenticationPanel>,
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
      <AuthenticationPanel
        description={`This application will receive API access as @${user.username}.`}
        title={`Authorize ${clientDetails.name}?`}
      >
        <AuthenticationNotice>
          It can perform the same Peated API actions your account can. Peated
          does not share your password or sign-in credentials.
        </AuthenticationNotice>
        {services.renderForm(parsed.data)}
      </AuthenticationPanel>,
    );
  };
}

export default createOAuthAuthorizationPage(pageServices);
