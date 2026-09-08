## Why

Peated's local CLI needs a standards-based way to obtain upstream API access without handling a user's password, passkey, or Google credential. The smallest correct server baseline is an authorization code flow with mandatory PKCE for public OAuth clients registered by Peated administrators.

## What Changes

- Add admin-only OAuth client registration and management for public clients; there is no public or dynamic client-registration endpoint.
- Add a small internal admin UI to list clients, register one, edit its name and redirect URIs, and activate or deactivate it.
- Add a narrow OAuth authorization-server profile using only the authorization code grant with mandatory PKCE `S256`.
- Validate authorization redirect URIs against the selected active client's administrator-registered redirect URIs, including native-app loopback port handling.
- Add a minimal authenticated browser authorization and consent flow that issues short-lived, single-use authorization codes.
- Add a form-encoded token endpoint that validates the complete PKCE binding and returns Peated's existing seven-day bearer access token for the authorizing user.
- Add focused integration coverage for admin client registration, successful authorization and exchange, redirect and PKCE validation, code expiry, and replay prevention.
- Keep refresh tokens, durable OAuth grants, token revocation, authorization-server discovery, granular scopes, device authorization, dynamic client registration, confidential clients, OpenID Connect, and the CLI command implementation out of scope for this change.

## Capabilities

### New Capabilities

- `oauth-pkce-authorization`: Administrator-managed public OAuth clients and PKCE-protected authorization-code exchange into Peated's existing bearer-token model.

### Modified Capabilities

None.

## Impact

- `apps/server/src/db/schema/` and a generated Drizzle migration for administrator-registered OAuth clients and single-use authorization codes.
- Admin-only oRPC routes and admin web pages for client registration, listing, inspection, editing, and activation state, plus a dedicated standards-shaped token adapter.
- `apps/web/src/app/` for the authenticated authorization/consent route that uses the existing Peated session and returns the browser to the loopback redirect URI.
- Credential-safe request handling, account-policy documentation, and focused tests across the server and minimal web authorization boundary.
- Existing bearer-token creation, validation, user activation, ToS, moderator, and admin behavior remains authoritative and compatible.
