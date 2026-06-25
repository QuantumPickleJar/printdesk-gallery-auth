const { randomUUID } = require('crypto');

function collapseDashes(input) {
  let output = '';
  let previousDash = false;
  for (const ch of input) {
    if (ch === '-') {
      if (!previousDash) {
        output += ch;
      }
      previousDash = true;
    } else {
      output += ch;
      previousDash = false;
    }
  }
  return output;
}

function trimDashes(input) {
  let start = 0;
  let end = input.length;
  while (start < end && input[start] === '-') start += 1;
  while (end > start && input[end - 1] === '-') end -= 1;
  return input.slice(start, end);
}

function slugify(value) {
  const text = String(value || '').toLowerCase().trim();
  let normalized = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const isLowerAlpha = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    normalized += (isLowerAlpha || isDigit) ? ch : '-';
    if (normalized.length >= 80) {
      break;
    }
  }
  return trimDashes(collapseDashes(normalized)) || 'print';
}

function sanitizeFileName(name) {
  const text = String(name || 'file');
  let normalized = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const isUpperAlpha = code >= 65 && code <= 90;
    const isLowerAlpha = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    const isAllowedPunctuation = ch === '.' || ch === '_' || ch === '-';
    normalized += (isUpperAlpha || isLowerAlpha || isDigit || isAllowedPunctuation) ? ch : '-';
    if (normalized.length >= 160) {
      break;
    }
  }
  normalized = normalized.replace(/^\.+/, '');
  return trimDashes(collapseDashes(normalized)) || 'file';
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
  const entryId = baseId || `print-${randomUUID()}`;

  return {
    id: entryId,
    title,
    shortDescription: String(fields.shortDescription || '').trim(),
    longDescription: String(fields.longDescription || '').trim(),
    material: String(fields.material || '').trim(),
    colors: parseTags(fields.colors),
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
