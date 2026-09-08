# PeatedBot Request Signing

PeatedBot identifies scraper traffic with
`PeatedBot/1.0 (+https://peated.com/bot)` and signs requests using Cloudflare Web
Bot Auth. The private signing key is a deployment secret. The public key is
served from
`https://peated.com/.well-known/http-message-signatures-directory`.

Cloudflare registration and a production source check are operational steps.
They cannot be completed by merging code alone.

## Create the key

Create a dedicated Ed25519 key on a trusted workstation. Do not create it in
the repository or a shared temporary directory. Replace the example directory
below with a private local path. The repository script creates the directory,
sets restrictive permissions, validates the generated JWK, and refuses to
overwrite an existing key. It uses Peated's supported Node.js version, so this
does not depend on the system OpenSSL build:

```bash
PEATED_BOT_KEY_DIR="/path/to/private/peated-bot-key"
pnpm --filter @peated/server generate:peated-bot-key -- "$PEATED_BOT_KEY_DIR"
```

The key is written to `$PEATED_BOT_KEY_DIR/peated-bot-private.jwk`. The script
prints only that path, never the key contents.

On macOS, copy the JWK without printing it:

```bash
pbcopy < "$PEATED_BOT_KEY_DIR/peated-bot-private.jwk"
```

Store the complete contents of `peated-bot-private.jwk` as the
`PEATED_BOT_PRIVATE_JWK` secret in:

- the Vercel production environment for `peated-web`;
- the Render `worker` service; and
- every Render API environment that runs scraper previews or setup.

Use the same JWK in each environment. Never put it in `.env.example`, source
control, logs, an issue, or a pull request. Store a recovery copy in the
approved secret manager. After the deployment secrets and recovery copy are
confirmed, remove the local files and their now-empty directory:

```bash
rm "$PEATED_BOT_KEY_DIR/peated-bot-private.jwk"
rmdir "$PEATED_BOT_KEY_DIR"
unset PEATED_BOT_KEY_DIR
```

Without the secret, scraper requests remain unsigned and the public key route
returns HTTP 503. This keeps local development and existing unsigned targets
working.

## Verify the deployment

Deploy the web and scraper services before registration.

1. Request the public directory and confirm it returns HTTP 200,
   `Content-Type: application/http-message-signatures-directory+json`,
   `Signature-Input`, and `Signature`.
2. Confirm every published key contains only `kty`, `crv`, and `x`. A `d`
   property is a private key leak. Remove the secret and deployment immediately
   if it appears.
3. From a server environment with the secret, run the crawl check:

   ```bash
   pnpm --filter @peated/server check:peated-bot-signature
   ```

   This uses the same signing function as the shared scraper transport and does
   not print request headers. Before registration, HTTP 401 is expected when the
   format is valid but the key is unknown. After registration, require HTTP 200;
   HTTP 401 can also mean that a known key failed verification. HTTP 400 means
   the request format is invalid.

4. Confirm an ordinary unsigned-compatible source still completes through
   Admin → Scrapers.

Do not print request headers while checking a signed request. The signature is
short-lived, but it is still authentication material.

## Register with Cloudflare

In the Cloudflare dashboard, open Manage Account → Configurations → Bot
Submission Form. Choose **Request Signature** as the verification method. Use
the public directory URL as the validation instruction and list
`PeatedBot/1.0 (+https://peated.com/bot)` as the user agent.

After Cloudflare accepts the submission:

1. Repeat the crawl test and require HTTP 200.
2. Run one bounded catalog request against a Cloudflare-backed source.
3. Record the UTC time, source, HTTP status, and scraper run ID in the issue or
   deployment record. Do not record request headers or the fetched body.
4. If Springbank still returns its Cloudflare block page, record that the site
   owner must allow PeatedBot. Do not add browser impersonation, proxies, or
   challenge bypasses.

## Rotate or recover the key

Cloudflare accepts several Ed25519 keys in one directory, but the current route
publishes one key. Rotate during a short scraper pause:

1. Create a new dedicated key while the old key remains active.
2. Pause scheduled scraper work.
3. Change the web deployment to publish the new key.
4. Submit or update the new public key with Cloudflare and wait for acceptance.
5. Change the worker and API secrets to the new key, then resume scraper work.
6. Require HTTP 200 from the crawl test and verify a Cloudflare-backed source.
7. Remove the old key from every deployment and the recovery store.

If the private key is lost, create and register a new key. If it may have been
exposed, remove it from scraper services first, contact Cloudflare to revoke the
registration, and then follow the rotation steps. Never reconstruct a key from
logs or copy a key from an untrusted machine.
