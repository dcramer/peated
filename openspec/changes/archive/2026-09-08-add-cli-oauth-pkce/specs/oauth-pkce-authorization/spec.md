## ADDED Requirements

### Requirement: Administrators manage public OAuth clients

The system SHALL persist system-wide public OAuth clients with a server-generated client id, administrator-controlled name and registered redirect URIs, active state, and timestamps. Only Peated administrators SHALL create, list, update, or deactivate OAuth clients. The system SHALL NOT expose dynamic or anonymous client registration and SHALL NOT issue client secrets.

#### Scenario: Administrator registers a client

- **WHEN** an authenticated administrator submits a valid name and redirect URI list
- **THEN** the server creates an active public client with a unique client id and returns its non-secret registration details.

#### Scenario: Non-administrator attempts registration

- **WHEN** a non-administrator or anonymous caller attempts to create or manage an OAuth client
- **THEN** the server rejects the operation and persists no client change.

#### Scenario: Administrator deactivates a client

- **WHEN** an administrator deactivates an existing OAuth client
- **THEN** the client can no longer begin authorization or exchange an authorization code.

#### Scenario: Administrator submits an unsafe redirect

- **WHEN** client registration includes a malformed URI, URI fragment, userinfo, wildcard host, or unsupported loopback value
- **THEN** the server rejects the registration and persists no client.

### Requirement: Administrators have an OAuth client management UI

The web application SHALL provide an admin-only OAuth client management surface using the existing admin layout and administrator-protected client operations. It SHALL list registered clients and their active state, provide a shared add/edit form for name and redirect URIs, display the generated client id as read-only, and provide explicit activate/deactivate actions. It MUST NOT display or imply a client secret.

#### Scenario: Administrator opens the client list

- **WHEN** an authenticated administrator visits the OAuth client admin page
- **THEN** the page lists each client's name, public client id, redirect summary, and active state and offers registration and editing actions.

#### Scenario: Administrator registers a client through the UI

- **WHEN** an administrator submits valid client data through the add form
- **THEN** the UI creates the client through the administrator-protected API and navigates to its management view.

#### Scenario: Administrator edits a client through the UI

- **WHEN** an administrator changes a client's name, redirect URIs, or active state
- **THEN** the UI persists the change through the administrator-protected API and presents the updated registration.

#### Scenario: Non-administrator reaches the admin URL

- **WHEN** an anonymous or non-administrator user requests an OAuth client admin route
- **THEN** the existing admin access boundary redirects or rejects the user and no client data is disclosed.

### Requirement: Authorization requests require PKCE and a registered redirect

The authorization endpoint MUST require `response_type=code`, an active registered `client_id`, a redirect URI allowed by that client, a nonempty `state`, a valid PKCE code challenge, and `code_challenge_method=S256`. It MUST treat `state` as an opaque client value, return it unchanged, and reject missing PKCE and every other challenge method.

Redirect matching MUST be exact except that a registered HTTP redirect using the literal loopback address `127.0.0.1` or `[::1]` MAY receive an ephemeral request port when all other URI components match. The server MUST NOT treat `localhost`, a wildcard, or a non-loopback address as that exception.

#### Scenario: Registered loopback request is valid

- **WHEN** an active client requests authorization using a registered loopback redirect with a permitted ephemeral port and valid `S256` challenge
- **THEN** the server makes the request eligible for user authorization.

#### Scenario: Registered exact redirect is valid

- **WHEN** an active client requests authorization using a redirect URI that exactly matches one of its registered URIs and valid `S256` PKCE
- **THEN** the server makes the request eligible for user authorization.

#### Scenario: Redirect is not registered

- **WHEN** a request changes a registered URI's scheme, non-loopback port, host, path, query, userinfo, or fragment outside the permitted loopback-port exception
- **THEN** the server renders an invalid-request error and MUST NOT redirect the browser to the submitted URI.

#### Scenario: Client is inactive

- **WHEN** an authorization request names an inactive or unknown client
- **THEN** the server rejects the request and issues no authorization code.

#### Scenario: PKCE is missing or downgraded

- **WHEN** the challenge is missing, malformed, uses `plain`, or names a method other than `S256`
- **THEN** the server rejects the request and issues no authorization code.

### Requirement: Authorization uses the existing Peated browser session

The browser authorization endpoint SHALL authenticate the resource owner through the existing Peated web session, preserve a valid request across login, display the registered client name and full Peated API access being requested, and require an explicit approve or deny action.

#### Scenario: Anonymous user opens a valid request

- **WHEN** a valid authorization request reaches the browser endpoint without an authenticated Peated session
- **THEN** the user is sent through normal Peated login and returned to the same authorization request afterward.

#### Scenario: User approves access

- **WHEN** an authenticated active user approves a still-valid request
- **THEN** the API creates a short-lived authorization code bound to that user, client, exact redirect URI, and PKCE challenge and returns the browser with the code and original state.

#### Scenario: User denies access

- **WHEN** an authenticated user denies a valid authorization request
- **THEN** the browser returns to the validated redirect URI with `error=access_denied` and the original state, and no authorization code is created.

### Requirement: Authorization codes are short-lived and single-use

The server SHALL generate authorization codes from cryptographically secure random data, SHALL store only a non-reversible digest, SHALL bind each code to its user, client, exact redirect URI, and PKCE challenge, and SHALL enforce a short expiration and one successful consumption.

#### Scenario: Fresh code is exchanged once

- **WHEN** an unexpired authorization code is presented with its bound active client, exact redirect URI, and valid verifier
- **THEN** the server atomically consumes the code and issues one existing-format Peated access token.

#### Scenario: Authorization code is replayed

- **WHEN** a consumed authorization code is presented again
- **THEN** the server returns `invalid_grant` and issues no additional token.

#### Scenario: Authorization code expires

- **WHEN** an authorization code is presented after its configured expiration
- **THEN** the server returns `invalid_grant` and issues no token.

### Requirement: Token exchange validates the complete PKCE binding

The token endpoint SHALL accept `application/x-www-form-urlencoded` requests for `grant_type=authorization_code` and SHALL validate the authorization code, active public client id, exact redirect URI, verifier syntax, and `S256` transformation before issuing an access token. It SHALL reject every other grant type and SHALL use OAuth token and error response shapes rather than the oRPC envelope.

#### Scenario: Correct verifier completes exchange

- **WHEN** the endpoint receives a fresh code and verifier whose `S256` challenge matches the stored challenge and all client and redirect bindings match
- **THEN** it returns the existing Peated access token with `token_type=Bearer` and its seven-day `expires_in`.

#### Scenario: Incorrect verifier is submitted

- **WHEN** the submitted verifier does not match the stored PKCE challenge
- **THEN** the server returns `invalid_grant`, leaves no successful exchange, and issues no token.

#### Scenario: Redirect URI differs during exchange

- **WHEN** the token request redirect URI differs from the exact URI bound to the authorization code, including its selected loopback port
- **THEN** the server returns `invalid_grant` and issues no token.

#### Scenario: Unsupported grant is requested

- **WHEN** the token endpoint receives a refresh-token, client-credentials, password, device, or other unsupported grant
- **THEN** it returns `unsupported_grant_type` and issues no token.

#### Scenario: Client is deactivated before exchange

- **WHEN** a client is deactivated after code issuance but before token exchange
- **THEN** the exchange is rejected and no token is issued.

### Requirement: OAuth tokens use existing Peated API authorization

An access token returned by OAuth code exchange SHALL use the existing Peated bearer-token format and SHALL remain subject to current user activation, verification, ToS, moderator, and admin checks. OAuth authorization MUST NOT elevate the user's permissions.

#### Scenario: OAuth-issued token calls the API

- **WHEN** a valid OAuth-issued access token is presented to an existing API route
- **THEN** the API authenticates and authorizes it through the existing Peated bearer-token path.

#### Scenario: User permissions change after token issuance

- **WHEN** the user's active, verified, ToS, moderator, or admin state changes after token issuance
- **THEN** subsequent API requests use the existing current-user behavior rather than treating OAuth authorization as an elevation.

### Requirement: OAuth credential material is not logged

The OAuth token endpoint MUST NOT log its form body, authorization code, code verifier, or returned access token. Token responses and authorization pages MUST use `Cache-Control: no-store`, and authorization pages MUST use `Referrer-Policy: no-referrer`.

#### Scenario: Token exchange fails

- **WHEN** authorization-code exchange fails validation
- **THEN** application logs exclude the submitted form body, code, and verifier.

#### Scenario: Authorization page is rendered

- **WHEN** the browser displays an authorization request
- **THEN** the response uses `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.

### Requirement: Existing authentication remains compatible

Adding OAuth PKCE SHALL NOT invalidate existing Peated access tokens or change established login and API authorization behavior.

#### Scenario: Existing token calls the API

- **WHEN** a valid token issued by an existing Peated login flow is presented after OAuth support is deployed
- **THEN** the API authenticates and authorizes it through the unchanged bearer-token path.
