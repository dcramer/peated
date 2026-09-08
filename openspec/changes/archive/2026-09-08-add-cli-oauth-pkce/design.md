## Context

Peated currently issues a seven-day JWT after password, magic-link, passkey, or Google login. API authentication validates that token, reloads the current user, and delegates authorization to existing verified, ToS, moderator, and admin middleware. There is no OAuth authorization-server surface, client registry, or authorization-code exchange.

The immediate consumer is a local CLI, but OAuth clients must not be hard-coded in application code. Peated administrators will register public clients and their allowed redirect URIs. The initial OAuth surface should be correct for authorization code with PKCE without building a general OAuth platform or a second token lifecycle.

## Goals / Non-Goals

**Goals:**

- Allow administrators to register, inspect, update, and deactivate public OAuth clients.
- Support browser authorization code flow with mandatory PKCE `S256`.
- Bind short-lived, single-use authorization codes to a user, client, exact redirect URI, and PKCE challenge.
- Exchange a valid code for Peated's existing seven-day bearer access token.
- Preserve all existing user activation, verification, ToS, moderator, and admin checks.
- Keep authorization codes and verifiers out of logs and traces.

**Non-Goals:**

- Implement refresh tokens, durable user grants, per-token revocation, discovery metadata, token introspection, or granular scopes.
- Implement dynamic/public client registration, client secrets, confidential clients, third-party self-service, a developer portal, or a client approval workflow beyond administrator registration.
- Support device authorization, implicit, password, or client-credentials grants, OpenID Connect, or the CLI itself.
- Replace or redesign Peated's existing JWT access token.

## Decisions

### Decision: Persist administrator-managed public OAuth clients

Add an `oauth_client` table containing:

- server-generated public `clientId`;
- administrator-controlled display name;
- registered redirect URI list;
- active flag;
- timestamps.

Admin-only oRPC operations will create, list, inspect, update, and deactivate clients. Registration accepts no client secret because every initially supported client is public and must use PKCE. There is no RFC dynamic-client-registration endpoint.

A small UI under `/admin/oauth-clients` will use those operations. It includes an index with client name, public client id, redirect summary, and active state; a shared add/edit form for name and redirect URIs; and explicit activate/deactivate actions. The generated client id is displayed read-only and there is no secret reveal or credential-download workflow. The existing admin layout and sidebar own navigation and coarse page access, while `requireAdmin` on every API operation remains the authoritative boundary.

Rationale: database registration and a modest operational UI let administrators add a future CLI or native tool without deployment, while avoiding tenant ownership, developer portals, approval queues, or secret rotation. Reusing existing admin list and shared-form patterns keeps the UI proportional to the feature.

Alternative considered: a statically configured `peated-cli` client. That is slightly smaller but contradicts the desired operational model and makes every new first-party client a code deployment.

### Decision: Register redirect URIs and compare them before redirecting

Every authorization request must provide `response_type=code`, an active registered `client_id`, a registered `redirect_uri`, a nonempty `state`, a valid `code_challenge`, and `code_challenge_method=S256`. The server treats `state` as opaque and returns it unchanged; generating and validating its entropy belongs to the client.

Redirect matching is exact except for native loopback URIs covered by RFC 8252: when an administrator registers an HTTP URI using the literal host `127.0.0.1` or `[::1]`, the request may select an ephemeral port while scheme, literal host, path, query, userinfo absence, and fragment absence continue to match the registered URI. `localhost`, wildcard hosts, and arbitrary callback paths are rejected.

Invalid client or redirect input is rendered as a local authorization error and is never used as a redirect destination. Once a redirect is validated, user denial may redirect with `error=access_denied` and the original `state`.

Rationale: administrator registration establishes the redirect trust boundary. Port flexibility is the one native-app exception needed by a desktop CLI.

### Decision: Keep the browser authorization endpoint on the web origin

The public authorization endpoint will be `https://peated.com/oauth/authorize`, implemented as a layout-free Next.js server route/page using the existing iron-session. It validates the request and shows the registered client name.

If the user is anonymous, the page sends them through normal Peated login and safely returns to the authorization request. Approve calls a narrow authenticated API operation that revalidates the active client, redirect URI, PKCE fields, and current user before issuing a code. Deny creates no durable state.

The API owns client lookup, validation, code generation, persistence, and token exchange. The web application owns only browser session handling, confirmation, and the final redirect.

Alternative considered: serve authorization directly from `api.peated.com`. The API does not own the Peated browser session, which would require an unnecessary second session or authentication handoff.

### Decision: Persist only short-lived authorization codes

Add an `oauth_authorization_code` table containing:

- random code digest;
- client and user references;
- exact request redirect URI;
- PKCE `S256` challenge;
- issuance, expiration, and consumed timestamps.

Codes use cryptographically secure random bytes, are stored only as SHA-256 digests, expire after two minutes, and are single-use. Token exchange validates every binding and atomically marks a valid code consumed so concurrent or repeated exchanges cannot both succeed. The implementation may use the database's simplest reliable conditional update or transaction rather than prescribing a locking strategy.

No durable grant or refresh-token table is introduced. The authorization code is the only new credential lifecycle.

### Decision: Reuse the existing access token after successful exchange

The token endpoint calls the existing `createAccessToken(user)` only after validating:

- `grant_type=authorization_code`;
- active registered public client;
- unexpired and unconsumed code;
- exact client and redirect binding;
- a syntactically valid verifier whose `S256` digest matches the stored challenge;
- an active current user.

It returns a standard OAuth token response with `access_token`, `token_type=Bearer`, and `expires_in=604800`. The token then behaves exactly like a token issued by existing Peated login. OAuth does not require the access token to expose client or grant details to the client.

Rationale: PKCE authorization and API token semantics are separate concerns. Reusing the existing token keeps this change focused, retains live user checks, and avoids introducing refresh rotation, grant lookup, or a parallel JWT format before there is a demonstrated need.

Trade-off: deactivating an OAuth client stops new authorizations and exchanges but does not revoke already issued bearer tokens. They expire within the existing seven-day lifetime or stop working immediately if the user is deactivated. Per-client token revocation is a future capability, not part of basic PKCE.

### Decision: Expose only the protocol endpoint required for exchange

The server adds `POST /oauth/token` as a dedicated Hono adapter because OAuth token requests use `application/x-www-form-urlencoded` and standard OAuth response/error shapes. It supports only `authorization_code`.

Client administration and browser-to-API code issuance remain typed oRPC operations because they are Peated-owned application surfaces. No discovery, revocation, introspection, or dynamic-registration endpoint is added.

### Decision: Avoid a new scope model

The first authorization page states that the client receives API access as the current Peated user. The authorization request does not negotiate granular scopes, and the returned token has the same capabilities as existing Peated bearer tokens.

Rationale: adding scopes without annotating and enforcing them across the API would create misleading security. Existing role and policy middleware is the real authorization boundary.

### Decision: Keep credential material out of application logging

The token adapter must not log its form body, authorization code, verifier, or returned access token. Token responses and the authorization page use `Cache-Control: no-store`, and the authorization page uses `Referrer-Policy: no-referrer`. This change does not add a new OAuth audit or analytics system.

### Decision: Test the real persistence and HTTP boundaries

Focused server integration tests use the real test database for client registration, successful code exchange, PKCE and redirect rejection, expiry, and replay prevention. Raw Hono tests verify form encoding and the core OAuth response shapes. Minimal web tests cover login continuation, approve/deny behavior, and refusing an invalid redirect.

## Risks / Trade-offs

- [The existing seven-day token cannot be revoked per OAuth client] → Keep this explicit, allow administrators to deactivate clients to stop new issuance, and defer token grants/revocation until required.
- [Admin-registered redirects can create an open redirect] → Parse and validate at registration, revalidate at authorization, and never redirect invalid client/redirect combinations.
- [Loopback port matching is intentionally less than exact] → Allow only RFC 8252 loopback IP literals and require every other URI component to match its registered value.
- [The web and API origins split one flow] → Keep all security decisions in API-owned helpers and revalidate inputs during approval and exchange.
- [A seven-day token requires periodic CLI reauthorization] → Accept this baseline behavior; refresh tokens can be added later when the CLI experience proves the need.
- [A broad bearer token gives all current account permissions] → Display this honestly and preserve the existing live user/role/ToS checks rather than inventing unenforced scopes.

## Migration Plan

1. Add OAuth client and authorization-code schema records and generate the Drizzle migration.
2. Add admin-only public-client management and redirect/PKCE validation helpers.
3. Add authorization-code issuance and the raw token exchange endpoint.
4. Add the minimal web authorization/consent route.
5. Deploy with no registered OAuth clients, then let an administrator register `peated-cli` and its loopback redirects.

Rollback disables the authorization and token routes and deactivates registered clients. Existing bearer tokens and web login remain independent.

## Open Questions

None blocking implementation. Client registration is admin-only, all clients are public PKCE clients, access tokens use the existing seven-day Peated JWT, and advanced OAuth lifecycle features are deferred.
