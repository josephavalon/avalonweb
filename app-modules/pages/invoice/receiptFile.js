/**
 * Turning a phone photo into something that fits in a JSON request body.
 *
 * There is no blob storage on the front door, so a receipt rides along inside
 * the submit request and out again as an email attachment. Nothing is persisted
 * anywhere, which is the point — the receipt lives in the approvers' inbox next
 * to the invoice it belongs to.
 *
 * That places a hard ceiling on size. Vercel caps a function request body at
 * 4.5 MB, and base64 inflates bytes by a third, so the real budget is ~3.3 MB of
 * file. A modern phone photo is 3-5 MB on its own, so images are downscaled and
 * re-encoded before they ever reach the wire. PDFs pass through untouched
 * because re-encoding them is not something a canvas can do.
 */

export const MAX_RECEIPT_BYTES = 1_200_000; // ~1.2 MB per receipt, after downscaling
export const MAX_TOTAL_RECEIPT_BYTES = 2_500_000; // ~3.4 MB once base64-encoded
export const MAX_IMAGE_EDGE = 1600;

export const ACCEPTED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const RECEIPT_ACCEPT_ATTR = 'image/*,application/pdf';

export function formatBytes(bytes) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be opened.'));
    img.src = dataUrl;
  });
}

/** Long edge capped, re-encoded as JPEG. Returns a data URL. */
async function downscaleImage(dataUrl) {
  const img = await loadImage(dataUrl);
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longEdge > MAX_IMAGE_EDGE ? MAX_IMAGE_EDGE / longEdge : 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  // Receipts are usually photographed against something dark; a white base stops
  // any transparency turning black in the email.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', 0.82);
}

function splitDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  const contentType = header.slice(header.indexOf(':') + 1, header.indexOf(';')) || 'application/octet-stream';
  // 4 base64 chars carry 3 bytes; the trailing '=' padding carries none.
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return { contentType, base64, bytes: Math.floor((base64.length * 3) / 4) - padding };
}

function safeFileName(name, contentType) {
  const cleaned = String(name || 'receipt')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .slice(0, 60) || 'receipt';
  if (/\.[a-z0-9]{2,5}$/i.test(cleaned)) return cleaned;
  return `${cleaned}${contentType === 'application/pdf' ? '.pdf' : '.jpg'}`;
}

/**
 * Returns { fileName, contentType, base64, bytes } or throws with a message
 * meant to be shown to the person who picked the file.
 */
export async function prepareReceipt(file) {
  if (!file) throw new Error('No file selected.');

  const isPdf = file.type === 'application/pdf';
  const isImage = file.type.startsWith('image/');
  if (!isPdf && !isImage) {
    throw new Error('Attach a photo or a PDF.');
  }

  const original = await readAsDataUrl(file);
  // HEIC from an iPhone will not decode in a canvas, so if downscaling fails the
  // original is used and the size cap does the rest of the work.
  let dataUrl = original;
  if (isImage) {
    try {
      dataUrl = await downscaleImage(original);
    } catch {
      dataUrl = original;
    }
  }

  let prepared = splitDataUrl(dataUrl);
  if (isImage && prepared.bytes > MAX_RECEIPT_BYTES) {
    // One more pass at lower quality before giving up on it.
    try {
      const img = await loadImage(dataUrl);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      prepared = splitDataUrl(canvas.toDataURL('image/jpeg', 0.65));
    } catch {
      /* keep the first attempt and let the cap below decide */
    }
  }

  if (prepared.bytes > MAX_RECEIPT_BYTES) {
    throw new Error(`That file is ${formatBytes(prepared.bytes)}. Please keep receipts under ${formatBytes(MAX_RECEIPT_BYTES)}.`);
  }

  return {
    fileName: safeFileName(file.name, prepared.contentType),
    contentType: prepared.contentType,
    base64: prepared.base64,
    bytes: prepared.bytes,
  };
}

export function totalReceiptBytes(expenses) {
  return expenses.reduce((sum, row) => sum + (row.receipt?.bytes || 0), 0);
}
