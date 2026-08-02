## 1. OAuth Client Registration

- [x] 1.1 Add `oauth_client` and `oauth_authorization_code` Drizzle schemas with active state, registered redirect URIs, code digests, PKCE binding, expiration, consumption, relations, and required indexes.
- [x] 1.2 Generate the database migration with `pnpm db:generate`, inspect the generated SQL and metadata, and add schema/database coverage without hand-editing migration artifacts.
- [x] 1.3 Add administrator-only oRPC operations to create, list, inspect, update, and deactivate public OAuth clients, generating a unique public client id and never issuing a client secret.
- [x] 1.4 Add integration tests proving admin-only client management, unique ids, redirect validation, updates, and deactivation.
- [x] 1.5 Add `/admin/oauth-clients` list, add, and edit routes using the existing admin layout/sidebar and a shared client form for name and redirect URIs, with a read-only public client id and explicit activate/deactivate controls.
- [x] 1.6 Add focused frontend tests for the client list and shared create/edit form, including validation and the existing admin access boundary, then manually verify the management flow.

## 2. Authorization Validation and Codes

- [x] 2.1 Add runtime schemas and helpers for authorization requests, registered redirect comparison including the loopback ephemeral-port exception, PKCE verifier/challenge syntax, `S256` calculation, secure code generation, and digesting.
- [x] 2.2 Add focused tests for exact and loopback redirect matching, unsafe or unregistered redirects, opaque state round-tripping, malformed PKCE, and unknown or inactive clients.
- [x] 2.3 Implement an authenticated authorization-code issuance service that revalidates the active client, registered redirect, PKCE request, current user, and expiry before persisting only the code digest.
- [x] 2.4 Implement atomic authorization-code exchange with exact client and redirect binding, verifier checking, two-minute expiration, and single consumption under concurrent or repeated requests.
- [x] 2.5 Add database integration tests for successful issuance/exchange, expiry, wrong verifier, redirect mismatch, replay, and client deactivation between issuance and exchange.

## 3. OAuth Token Endpoint

- [x] 3.1 Add a dedicated Hono `POST /oauth/token` adapter for form-encoded authorization-code exchange, supporting only public clients and `grant_type=authorization_code`.
- [x] 3.2 Return the existing Peated access token from `createAccessToken(user)` with standard `access_token`, `token_type=Bearer`, and seven-day `expires_in` fields after successful exchange.
- [x] 3.3 Return standards-shaped OAuth errors for malformed requests, invalid grants, and unsupported grant types without using the oRPC envelope.
- [x] 3.4 Add focused raw HTTP tests for form parsing, a successful response, representative OAuth errors, no-store headers, and use of the returned token on an existing authenticated API route.

## 4. Browser Authorization

- [x] 4.1 Add the layout-free `peated.com/oauth/authorize` route/page to parse authorization requests, resolve the registered client through the API, render invalid requests without unsafe redirects, and send anonymous users through existing login with a safe return path.
- [x] 4.2 Display the registered client name and full Peated API access, then add approve and deny server actions that revalidate the request and redirect only to the validated URI with the original state and either a code or `error=access_denied`.
- [x] 4.3 Apply `Cache-Control: no-store` and `Referrer-Policy: no-referrer` to the authorization surface.
- [x] 4.4 Add focused web tests for login continuation, approve, deny, state preservation, and refusing an invalid redirect.

## 5. Security, Documentation, and Verification

- [x] 5.1 Ensure the token endpoint does not log form bodies, codes, verifiers, or access tokens, and apply the specified no-store and no-referrer response headers.
- [x] 5.2 Update `docs/architecture/account-policies.md` with admin-only public client registration, PKCE authorization, existing token behavior, seven-day reauthorization, and the explicit exclusion of refresh, revocation, discovery, dynamic registration, client secrets, and scopes.
- [x] 5.3 Run targeted server and web tests, server and web typechecks, and file-scoped lint/format checks for every touched surface.
- [x] 5.4 Complete local browser verification of the successful loopback flow, denial, authenticated API access, and replay rejection using the local UI verification playbook.
