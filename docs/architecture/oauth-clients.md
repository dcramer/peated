# OAuth Clients

Peated supports the OAuth authorization-code flow for local and other public
clients. OAuth lets a user approve a client without giving it their password.

- Only Peated administrators can register clients under
  `/admin/oauth-clients`.
- Clients have no secret. They must use PKCE `S256`, which ties an authorization
  request to its token exchange.
- Each redirect address must be registered by an administrator.
- Authorization happens at `https://peated.com/oauth/authorize` with the
  existing Peated browser session.
- Authorization codes are stored only as digests, expire after two minutes, and
  can be exchanged once at `POST https://api.peated.com/oauth/token`.
- A successful exchange returns the normal seven-day bearer token. It adds no
  permissions and remains subject to current account, Terms, verification, and
  administrator checks.
- Deactivating a client stops new authorizations and exchanges. It does not
  revoke tokens that were already issued.

Peated does not support refresh tokens, scopes, dynamic client registration,
client secrets, device authorization, OpenID Connect, or per-client token
revocation.

The database schema, routes under `apps/server/src/orpc/routes/oauth/`, and
administrator client routes own exact behavior.
