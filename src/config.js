const path = require('path');

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function normalizeSameSite(value) {
  const normalized = String(value || 'Lax').trim().toLowerCase();
  if (normalized === 'none') return 'None';
  if (normalized === 'strict') return 'Strict';
  return 'Lax';
}

const config = {
  port: Number(process.env.PORT || 5175),
  host: process.env.HOST || process.env.BIND_HOST || '0.0.0.0',
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  allowedUser: process.env.ALLOWED_GITHUB_USER || 'QuantumPickleJar',
  targetOwner: process.env.TARGET_OWNER || 'QuantumPickleJar',
  targetRepo: process.env.TARGET_REPO || 'Personal-Static',
  targetBranch: process.env.TARGET_BRANCH || 'main',
  galleryJsonPath: process.env.GALLERY_JSON_PATH || 'data/3d-print-gallery.json',
  assetBasePath: (process.env.GALLERY_ASSET_BASE_PATH || 'assets/gallery').replace(/\\/g, '/'),
  attachmentBasePath: (process.env.GALLERY_ATTACHMENT_BASE_PATH || 'assets/gallery-attachments').replace(/\\/g, '/'),
  sessionCookie: process.env.SESSION_COOKIE_NAME || 'pg_admin_sid',
  sessionCookieSameSite: normalizeSameSite(process.env.SESSION_COOKIE_SAMESITE),
  sessionCookieSecure: parseBoolean(process.env.SESSION_COOKIE_SECURE, false),
  localOwnerUnlock: process.env.LOCAL_OWNER_UNLOCK || '',
  localOwnerUnlockSha256: process.env.LOCAL_OWNER_UNLOCK_SHA256 || '',
  localOwnerSessionMinutes: Number(process.env.LOCAL_OWNER_SESSION_MINUTES || 240),
  localOwnerAllowedOrigins: parseCsv(process.env.LOCAL_OWNER_ALLOWED_ORIGINS),
  staticDir: path.join(process.cwd(), 'public')
};

module.exports = { config };
