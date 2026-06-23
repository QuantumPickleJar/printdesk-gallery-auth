const path = require('path');

const config = {
  port: Number(process.env.PORT || 5174),
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  allowedUser: process.env.ALLOWED_GITHUB_USER || 'QuantumPickleJar',
  targetOwner: process.env.TARGET_OWNER || 'QuantumPickleJar',
  targetRepo: process.env.TARGET_REPO || 'Personal-Static',
  targetBranch: process.env.TARGET_BRANCH || 'feat/3d-print-gallery',
  galleryJsonPath: process.env.GALLERY_JSON_PATH || 'data/3d-print-gallery.json',
  assetBasePath: (process.env.GALLERY_ASSET_BASE_PATH || 'assets/gallery').replace(/\\/g, '/'),
  attachmentBasePath: (process.env.GALLERY_ATTACHMENT_BASE_PATH || 'assets/gallery-attachments').replace(/\\/g, '/'),
  sessionCookie: process.env.SESSION_COOKIE_NAME || 'pg_admin_sid',
  sessionSecret: process.env.SESSION_SECRET || 'local-dev-only-change-me',
  staticDir: path.join(process.cwd(), 'public')
};

module.exports = { config };
