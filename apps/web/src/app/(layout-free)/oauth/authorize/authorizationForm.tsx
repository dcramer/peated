import type { OAuthAuthorizationRequest } from "@peated/server/schemas";
import Button from "@peated/web/components/button";
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
    <div className="flex flex-col gap-3 sm:flex-row">
      <form action={approveOAuthAuthorization} className="flex-1">
        <AuthorizationFields request={request} />
        <Button type="submit" color="highlight" fullWidth>
          Allow Access
        </Button>
      </form>
      <form action={denyOAuthAuthorization} className="flex-1">
        <AuthorizationFields request={request} />
        <Button type="submit" fullWidth>
          Deny
        </Button>
      </form>
    </div>
  );
}
