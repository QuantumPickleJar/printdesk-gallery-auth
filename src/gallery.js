function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'print';
}

function sanitizeFileName(name) {
  return String(name || 'file')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/^-+|-+$/g, '') || 'file';
}

function parseTags(raw) {
  return String(raw || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseExistingGallery(content) {
  if (!content) {
    return { entries: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { entries: [] };
  }

  if (Array.isArray(parsed)) {
    return { entries: parsed };
  }

  if (parsed && Array.isArray(parsed.entries)) {
    return parsed;
  }

  return { entries: [] };
}

function buildEntry(fields, imagePaths, attachmentPath, existingId) {
  const title = String(fields.title || '').trim();
  const baseId = slugify(existingId || fields.id || title);
  const entryId = baseId || `print-${Date.now()}`;

  return {
    id: entryId,
    title,
    shortDescription: String(fields.shortDescription || '').trim(),
    longDescription: String(fields.longDescription || '').trim(),
    material: String(fields.material || '').trim(),
    printer: String(fields.printer || '').trim(),
    nozzle: String(fields.nozzle || '').trim(),
    layerHeight: String(fields.layerHeight || '').trim(),
    printTime: String(fields.printTime || '').trim(),
    tags: parseTags(fields.tags),
    category: String(fields.category || '').trim(),
    status: String(fields.status || '').trim(),
    notes: String(fields.notes || '').trim(),
    images: imagePaths,
    attachment: attachmentPath || null,
    updatedAt: new Date().toISOString()
  };
}

function mergeEntry(existingContent, entry) {
  const gallery = parseExistingGallery(existingContent);
  const index = gallery.entries.findIndex((item) => item.id === entry.id);

  if (index >= 0) {
    gallery.entries[index] = { ...gallery.entries[index], ...entry };
  } else {
    gallery.entries.push(entry);
  }

  return JSON.stringify(gallery, null, 2) + '\n';
}

module.exports = {
  slugify,
  sanitizeFileName,
  parseExistingGallery,
  buildEntry,
  mergeEntry
};
