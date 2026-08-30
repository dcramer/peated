import type { OAuthAuthorizationRequest } from "@peated/server/schemas";
import { Button } from "@peated/web/components";
import { AuthenticationActions } from "@peated/web/components/pages/authentication.stylex";
import { approveOAuthAuthorization, denyOAuthAuthorization } from "./actions";

function AuthorizationFields({
  request,
}: {
  request: OAuthAuthorizationRequest;
}) {
  return (
    <>
      <input type="hidden" name="response_type" value={request.responseType} />
      <input type="hidden" name="client_id" value={request.clientId} />
      <input type="hidden" name="redirect_uri" value={request.redirectUri} />
      <input type="hidden" name="state" value={request.state} />
      <input
        type="hidden"
        name="code_challenge"
        value={request.codeChallenge}
      />
      <input
        type="hidden"
        name="code_challenge_method"
        value={request.codeChallengeMethod}
      />
    </>
  );
}

export default function AuthorizationForm({
  request,
}: {
  request: OAuthAuthorizationRequest;
}) {
  return (
    <AuthenticationActions>
      <form action={approveOAuthAuthorization}>
        <AuthorizationFields request={request} />
        <Button
          align="start"
          fullWidth
          size="lg"
          type="submit"
          variant="accent"
        >
          Allow access
        </Button>
      </form>
      <form action={denyOAuthAuthorization}>
        <AuthorizationFields request={request} />
        <Button align="start" fullWidth size="lg" type="submit" variant="tonal">
          Deny
        </Button>
      </form>
    </AuthenticationActions>
  );
}
