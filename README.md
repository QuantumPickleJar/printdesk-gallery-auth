# printdesk-gallery-auth

Local mobile-friendly admin companion app for updating 3D print gallery entries in `QuantumPickleJar/Personal-Static`.

## Setup for local development

```bash
npm install
npm run dev
```

The service reads configuration from process environment variables. This pass intentionally does **not** load `dotenv`; use shell variables locally or a systemd `EnvironmentFile` on the Pi.

Open `http://localhost:5175` by default.

## Security model

- Uses GitHub OAuth device flow.
- Stores access token server-side only (HTTP-only cookie session + in-memory token).
- Rejects authenticated users other than `QuantumPickleJar` by default.
- Never stores token in browser storage.
- Does not require a GitHub personal access token in the public portfolio page.

## Environment

`.env.example` is safe to commit. The real `.env` should be created on the Pi only and must not be committed.

```env
PORT=5175
GITHUB_CLIENT_ID=<oauth-app-client-id>
GITHUB_CLIENT_SECRET=<optional-oauth-app-client-secret>
ALLOWED_GITHUB_USER=QuantumPickleJar
TARGET_OWNER=QuantumPickleJar
TARGET_REPO=Personal-Static
TARGET_BRANCH=main
GALLERY_JSON_PATH=data/3d-print-gallery.json
GALLERY_ASSET_BASE_PATH=assets/gallery
GALLERY_ATTACHMENT_BASE_PATH=assets/gallery-attachments
SESSION_COOKIE_NAME=pg_admin_sid
```

Important defaults:

- `PORT`: `5175`
- `TARGET_BRANCH`: `main`
- `GALLERY_JSON_PATH`: `data/3d-print-gallery.json`
- `GALLERY_ASSET_BASE_PATH`: `assets/gallery`
- `GALLERY_ATTACHMENT_BASE_PATH`: `assets/gallery-attachments`

## systemd deployment on the Pi

Create the real environment file on the Pi:

```bash
cd /path/to/printdesk-gallery-auth
nano .env
chmod 600 .env
```

Example unit:

```ini
[Unit]
Description=Printdesk Gallery Auth Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/path/to/printdesk-gallery-auth
EnvironmentFile=/path/to/printdesk-gallery-auth/.env
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Restart and inspect:

```bash
sudo systemctl daemon-reload
sudo systemctl restart <service-name>
sudo systemctl status <service-name>
```

Startup diagnostics intentionally log only safe values:

- whether `GITHUB_CLIENT_ID` is present
- target owner/repo/branch
- gallery JSON path
- asset/attachment base paths
- session cookie name

They do **not** print `GITHUB_CLIENT_SECRET` or access tokens.

## Route verification

Health check:

```bash
curl http://192.168.0.149:5175/api/health
```

Expected:

```json
{"ok":true}
```

Device flow start:

```bash
curl -X POST http://192.168.0.149:5175/api/auth/device/start
```

Expected when env is loaded correctly: a GitHub device-flow response containing a user code and verification URI.

Expected when env is not loaded:

```json
{"error":"GITHUB_CLIENT_ID is required"}
```

That error means systemd is still not injecting the environment or the `.env` does not contain `GITHUB_CLIENT_ID`.

## Workflow

1. Start device flow login.
2. Authenticate in GitHub and poll login status.
3. Fill gallery form and upload one or more images.
4. Use **Dry Run** to inspect intended file changes.
5. Submit to create/update gallery JSON + files in one commit.
6. Copy the returned commit URL.

## Testing

```bash
npm install
npm run test
```
