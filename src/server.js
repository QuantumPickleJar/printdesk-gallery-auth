const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { config } = require('./config');
const {
  startDeviceFlow,
  pollDeviceFlow,
  revokeToken,
  getUser,
  getFile,
  getBranchHead,
  getCommit,
  getTree,
  createBlob,
  createTree,
  createCommit,
  updateRef
} = require('./github');
const { sanitizeFileName, buildEntry, mergeEntry, slugify } = require('./gallery');

const app = express();
const maxUploadFileSizeBytes = Number(process.env.GALLERY_UPLOAD_FILE_LIMIT_BYTES || 95 * 1024 * 1024);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadFileSizeBytes } });
const sessions = new Map();
const rateWindowMs = 60_000;
const maxRequestsPerWindow = 180;
const requestBuckets = new Map();
const indexHtml = fs.readFileSync(path.join(config.staticDir, 'index.html'), 'utf8');

function rateLimit(req, res, next) {
  const now = Date.now();
  const key = `${req.ip}:${req.path}`;
  const bucket = requestBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    requestBuckets.set(key, { count: 1, resetAt: now + rateWindowMs });
    return next();
  }

  bucket.count += 1;
  if (bucket.count > maxRequestsPerWindow) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  return next();
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit);
app.use(express.static(config.staticDir));

function getCookie(req, name) {
  const header = req.headers.cookie || '';
  const parts = header.split(';').map((item) => item.trim());
  const pair = parts.find((item) => item.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

function getSession(req, res) {
  let sid = getCookie(req, config.sessionCookie);
  if (!sid || !sessions.has(sid)) {
    sid = crypto.randomBytes(24).toString('hex');
    sessions.set(sid, {});
    res.setHeader('Set-Cookie', `${config.sessionCookie}=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax`);
  }
  return sessions.get(sid);
}

function requireAuth(req, res, next) {
  const session = getSession(req, res);
  if (!session.token || !session.username) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.session = session;
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/device/start', async (req, res) => {
  try {
    if (!config.githubClientId) {
      return res.status(400).json({ error: 'GITHUB_CLIENT_ID is required' });
    }

    const session = getSession(req, res);
    const flow = await startDeviceFlow(config.githubClientId);
    session.deviceCode = flow.device_code;
    session.expiresAt = Date.now() + (Number(flow.expires_in) || 900) * 1000;

    return res.json({
      userCode: flow.user_code,
      verificationUri: flow.verification_uri,
      verificationUriComplete: flow.verification_uri_complete,
      interval: flow.interval || 5,
      expiresIn: flow.expires_in
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/device/poll', async (req, res) => {
  try {
    const session = getSession(req, res);
    if (!session.deviceCode || !session.expiresAt || session.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'No active device flow. Start a new login.' });
    }

    const result = await pollDeviceFlow(config.githubClientId, session.deviceCode);
    if (result.pending) {
      return res.json({ authenticated: false, pending: true, reason: result.error });
    }

    const user = await getUser(result.token);
    if (user.login !== config.allowedUser) {
      return res.status(403).json({ error: `User ${user.login} is not allowed` });
    }

    session.token = result.token;
    session.username = user.login;
    delete session.deviceCode;
    delete session.expiresAt;

    return res.json({ authenticated: true, username: user.login });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  const session = getSession(req, res);
  if (!session.username) {
    return res.json({ authenticated: false });
  }
  return res.json({ authenticated: true, username: session.username });
});

app.post('/api/auth/logout', async (req, res) => {
  const session = getSession(req, res);
  const token = session.token;
  delete session.token;
  delete session.username;
  delete session.deviceCode;
  delete session.expiresAt;

  try {
    await revokeToken(config.githubClientId, config.githubClientSecret, token);
  } catch {
    // best effort revoke
  }

  return res.json({ ok: true });
});

function getTextContent(contentFile) {
  if (!contentFile || !contentFile.content) {
    return '';
  }

  return Buffer.from(contentFile.content, 'base64').toString('utf8');
}

app.post('/api/gallery/submit', requireAuth, upload.fields([
  { name: 'images', maxCount: 20 },
  { name: 'attachment', maxCount: 1 }
]), async (req, res) => {
  try {
    const dryRun = String(req.query.dryRun || '').toLowerCase() === 'true';
    const token = req.session.token;

    const title = String(req.body.title || '').trim();
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const files = req.files || {};
    const images = (files.images || []);
    if (!images.length) {
      return res.status(400).json({ error: 'At least one image is required' });
    }

    const existingJson = await getFile(config.targetOwner, config.targetRepo, config.galleryJsonPath, config.targetBranch, token);
    const existingJsonContent = getTextContent(existingJson);

    const rawId = String(req.body.id || '').trim();
    const imagePaths = [];
    const entryId = slugify(rawId || title);

    const filePayloads = [];
    for (const image of images) {
      const cleanName = sanitizeFileName(image.originalname);
      const outputPath = path.posix.join(config.assetBasePath, entryId, cleanName);
      imagePaths.push(outputPath);
      filePayloads.push({ path: outputPath, content: image.buffer.toString('base64') });
    }

    let attachmentPath = null;
    const attachment = files.attachment && files.attachment[0];
    if (attachment) {
      const cleanAttachment = sanitizeFileName(attachment.originalname);
      attachmentPath = path.posix.join(config.attachmentBasePath, entryId, cleanAttachment);
      filePayloads.push({ path: attachmentPath, content: attachment.buffer.toString('base64') });
    }

    const entry = buildEntry(req.body, imagePaths, attachmentPath, entryId);
    const galleryJsonContent = mergeEntry(existingJsonContent, entry);
    filePayloads.push({ path: config.galleryJsonPath, content: Buffer.from(galleryJsonContent, 'utf8').toString('base64') });

    const headRef = await getBranchHead(config.targetOwner, config.targetRepo, config.targetBranch, token);
    const baseCommitSha = headRef.object.sha;
    const commitData = await getCommit(config.targetOwner, config.targetRepo, baseCommitSha, token);
    const tree = await getTree(config.targetOwner, config.targetRepo, commitData.tree.sha, token);
    const existingFiles = new Set((tree.tree || []).map((node) => node.path));

    const plannedChanges = filePayloads.map((file) => ({
      path: file.path,
      action: existingFiles.has(file.path) ? 'update' : 'create'
    }));

    if (dryRun) {
      return res.json({
        dryRun: true,
        target: `${config.targetOwner}/${config.targetRepo}@${config.targetBranch}`,
        commitMessage: `gallery: ${entry.id} (${entry.title})`,
        plannedChanges
      });
    }

    const treeEntries = [];
    for (const file of filePayloads) {
      const sha = await createBlob(config.targetOwner, config.targetRepo, file.content, token);
      treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha });
    }

    const newTreeSha = await createTree(config.targetOwner, config.targetRepo, commitData.tree.sha, treeEntries, token);
    const message = `gallery: ${entry.id} (${entry.title})`;
    const commitSha = await createCommit(config.targetOwner, config.targetRepo, message, newTreeSha, baseCommitSha, token);
    await updateRef(config.targetOwner, config.targetRepo, config.targetBranch, commitSha, token);

    return res.json({
      dryRun: false,
      commitSha,
      commitUrl: `https://github.com/${config.targetOwner}/${config.targetRepo}/commit/${commitSha}`,
      plannedChanges
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error: err.code === 'LIMIT_FILE_SIZE'
        ? `Uploaded file is too large. Maximum per-file size is ${Math.round(maxUploadFileSizeBytes / 1024 / 1024)} MiB.`
        : err.message,
      code: err.code,
      maxFileSizeBytes: maxUploadFileSizeBytes
    });
  }

  return next(err);
});

app.get(/.*/, (_req, res) => {
  res.type('html').send(indexHtml);
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`printdesk-gallery-auth listening on http://localhost:${config.port}`);
  });
}

module.exports = { app };
