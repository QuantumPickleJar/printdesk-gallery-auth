# pickle-gallery-admin

Local mobile-friendly admin companion app for updating 3D print gallery entries in `QuantumPickleJar/Personal-Static`.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5174`.

## Security model

- Uses GitHub OAuth device flow.
- Stores access token server-side only (HTTP-only cookie session + in-memory token).
- Rejects authenticated users other than `QuantumPickleJar` (configurable via env).
- Never stores token in browser storage.

## Environment

- `GITHUB_CLIENT_ID` (required)
- `GITHUB_CLIENT_SECRET` (optional, for revoke on logout)
- `TARGET_OWNER` (default `QuantumPickleJar`)
- `TARGET_REPO` (default `Personal-Static`)
- `TARGET_BRANCH` (default `feat/3d-print-gallery`)
- `GALLERY_JSON_PATH` (default `data/3d-print-gallery.json`)
- `GALLERY_ASSET_BASE_PATH` (default `assets/gallery`)
- `GALLERY_ATTACHMENT_BASE_PATH` (default `assets/gallery-attachments`)

## Workflow

1. Start device flow login.
2. Authenticate in GitHub and poll login status.
3. Fill gallery form and upload one or more images.
4. Use **Dry Run** to inspect intended file changes.
5. Submit to create/update gallery JSON + files in one commit.
6. Copy the returned commit URL.
