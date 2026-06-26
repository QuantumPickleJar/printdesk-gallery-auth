# pickle-gallery-admin

Local mobile-friendly admin companion app for updating 3D print gallery entries in `QuantumPickleJar/Personal-Static`.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5175` for local development.

## Security model

- Uses GitHub OAuth device flow.
- Stores access token server-side only (HTTP-only cookie session + in-memory token).
- Rejects authenticated users other than `QuantumPickleJar` (configurable via env).
- Never stores token in browser storage.
- Optional local owner unlock is a trusted LAN/Tailnet development fallback for TokenForge PrintDesk only. It is not a public production auth replacement.

## Environment

- `PORT` (default `5175`)
- `HOST` / `BIND_HOST` (default `0.0.0.0`)
- `GITHUB_CLIENT_ID` (required for GitHub device flow)
- `GITHUB_CLIENT_SECRET` (optional, for revoke on logout)
- `TARGET_OWNER` (default `QuantumPickleJar`)
- `TARGET_REPO` (default `Personal-Static`)
- `TARGET_BRANCH` (default `main`)
- `GALLERY_JSON_PATH` (default `data/3d-print-gallery.json`)
- `GALLERY_ASSET_BASE_PATH` (default `assets/gallery`)
- `GALLERY_ATTACHMENT_BASE_PATH` (default `assets/gallery-attachments`)
- `LOCAL_OWNER_UNLOCK` or `LOCAL_OWNER_UNLOCK_SHA256` (optional local/demo unlock password)
- `LOCAL_OWNER_SESSION_MINUTES` (default `240`)
- `LOCAL_OWNER_ALLOWED_ORIGINS` (comma-separated credentialed CORS allowlist)
- `SESSION_COOKIE_SAMESITE` (`Lax`, `Strict`, or `None`; default `Lax`)
- `SESSION_COOKIE_SECURE` (`true` or `false`; default `false`)

Do not commit a real `.env` file.

## Tailnet HTTPS local owner unlock

Tailnet HTTPS is the recommended mode for using the PrintDesk local owner unlock from another device. The Node app can keep listening only on the Pi, while Tailscale Serve exposes it over HTTPS inside your tailnet.

Start the Node service normally on the Pi, then expose it through Tailscale Serve on a non-root HTTPS port so it does not collide with other services that may already own the root Tailnet URL:

```bash
sudo tailscale serve --bg --https=8443 http://127.0.0.1:5175
tailscale serve status
```

The matching PrintDesk frontend env should use the Tailnet HTTPS URL:

```env
VITE_ENABLE_LOCAL_OWNER_UNLOCK=true
VITE_LOCAL_OWNER_AUTH_URL=https://<pi-full-tailnet-name>:8443
```

The Pi `.env` should allow the exact PrintDesk frontend origin and use cross-site secure cookies:

```env
LOCAL_OWNER_ALLOWED_ORIGINS=https://<desktop-full-tailnet-name>,http://localhost:5173,http://127.0.0.1:5173
SESSION_COOKIE_SAMESITE=None
SESSION_COOKIE_SECURE=true
```

Modern browsers require `SameSite=None` cookies to also be `Secure`, so this mode requires HTTPS. For local HTTP-only testing, use `SESSION_COOKIE_SAMESITE=Lax` and `SESSION_COOKIE_SECURE=false`.

Test the local backend directly:

```bash
curl http://127.0.0.1:5175/api/local-owner/status
```

Test the Tailnet HTTPS proxy from another tailnet device:

```bash
curl https://<pi-full-tailnet-name>:8443/api/local-owner/status
```

Expected when the unlock password env is loaded but the current browser/session is still locked:

```json
{"enabled":true,"unlocked":false,"expiresAt":null}
```

## Workflow

1. Start device flow login.
2. Authenticate in GitHub and poll login status.
3. Fill gallery form and upload one or more images.
4. Use **Dry Run** to inspect intended file changes.
5. Submit to create/update gallery JSON + files in one commit.
6. Copy the returned commit URL.

## Local owner unlock API

These endpoints are used by `tokenforge-printdesk` during trusted local/Tailnet development:

```text
GET  /api/local-owner/status
POST /api/local-owner/unlock
POST /api/local-owner/lock
```

All browser calls should use credentials so the HttpOnly session cookie is sent:

```js
fetch(`${LOCAL_OWNER_AUTH_URL}/api/local-owner/status`, { credentials: 'include' })
```

Credentialed CORS is intentionally allowlist-only. Do not use `Access-Control-Allow-Origin: *` with credentials.
