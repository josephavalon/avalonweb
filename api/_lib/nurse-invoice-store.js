import crypto from 'crypto';

export const NURSE_INVOICE_RECEIPT_BUCKET = 'nurse-invoice-receipts';
export const SUBMISSION_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== 'object' || Buffer.isBuffer(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}

export function stableJson(value) {
  return JSON.stringify(sortValue(value));
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function invoiceRequestHash(value) {
  return sha256(stableJson(value));
}

export function validSubmissionUuid(value) {
  return SUBMISSION_UUID_RE.test(String(value || '').trim());
}

export function sniffReceiptType(buffer) {
  if (!Buffer.isBuffer(buffer)) return '';
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return '';
}

export function receiptExtension(contentType) {
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

export function receiptStoragePath({ tenantId, invoiceId, receiptIndex, checksum, contentType }) {
  return `${tenantId}/${invoiceId}/${String(receiptIndex).padStart(2, '0')}-${checksum}.${receiptExtension(contentType)}`;
}

export function sharedDoorIdentityAssurance({ knownContractor, activeProfile, namesMatch }) {
  if (knownContractor && activeProfile && namesMatch) return 'shared_door_profile_match';
  if (knownContractor) return 'shared_door_roster_match';
  return 'shared_door_unmatched';
}

export async function persistReceiptFiles(db, { tenantId, invoiceId, receipts }) {
  if (!receipts.length) return { status: 'none', rows: [] };
  const rows = [];
  try {
    const existingResult = await db.from('nurse_invoice_receipts')
      .select('*').eq('tenant_id', tenantId).eq('invoice_id', invoiceId);
    if (existingResult.error) throw existingResult.error;
    const existingByIndex = new Map((existingResult.data || []).map((row) => [Number(row.receipt_index), row]));

    for (const receipt of receipts) {
      const existing = existingByIndex.get(receipt.index);
      if (existing) {
        if (existing.checksum_sha256 !== receipt.checksum) {
          throw Object.assign(new Error('Receipt content changed for this submission.'), { code: 'receipt_idempotency_conflict' });
        }
        rows.push(existing);
        continue;
      }
      const storagePath = receiptStoragePath({
        tenantId, invoiceId, receiptIndex: receipt.index,
        checksum: receipt.checksum, contentType: receipt.contentType,
      });
      const upload = await db.storage.from(NURSE_INVOICE_RECEIPT_BUCKET).upload(storagePath, receipt.buffer, {
        contentType: receipt.contentType,
        cacheControl: '0',
        upsert: false,
      });
      if (upload.error && !/already exists|duplicate/i.test(String(upload.error.message || ''))) throw upload.error;
      try {
        const inserted = await db.from('nurse_invoice_receipts').upsert({
          tenant_id: tenantId,
          invoice_id: invoiceId,
          receipt_index: receipt.index,
          storage_path: storagePath,
          file_name: receipt.fileName,
          content_type: receipt.contentType,
          byte_size: receipt.byteSize,
          checksum_sha256: receipt.checksum,
          scan_status: 'quarantined',
        }, { onConflict: 'invoice_id,receipt_index', ignoreDuplicates: true }).select('*').maybeSingle();
        if (inserted.error) throw inserted.error;
        let metadata = inserted.data;
        if (!metadata) {
          const authoritative = await db.from('nurse_invoice_receipts').select('*')
            .eq('tenant_id', tenantId)
            .eq('invoice_id', invoiceId)
            .eq('receipt_index', receipt.index)
            .maybeSingle();
          if (authoritative.error) throw authoritative.error;
          metadata = authoritative.data;
        }
        if (!metadata || metadata.storage_path !== storagePath || metadata.checksum_sha256 !== receipt.checksum) {
          throw Object.assign(new Error('Receipt metadata could not be confirmed.'), {
            code: 'receipt_metadata_unconfirmed',
          });
        }
        rows.push(metadata);
      } catch (metadataError) {
        // An object without its tenant-scoped metadata row is not addressable or
        // auditable. A duplicate upload can be a leftover from an earlier crash,
        // so first prove that matching metadata owns it; otherwise compensate by
        // removing the deterministic object path.
        let matchingMetadataExists = false;
        try {
          const authoritative = await db.from('nurse_invoice_receipts')
            .select('storage_path, checksum_sha256')
            .eq('tenant_id', tenantId)
            .eq('invoice_id', invoiceId)
            .eq('receipt_index', receipt.index)
            .maybeSingle();
          matchingMetadataExists = Boolean(
            !authoritative.error
            && authoritative.data?.storage_path === storagePath
            && authoritative.data?.checksum_sha256 === receipt.checksum,
          );
        } catch {
          matchingMetadataExists = false;
        }
        if (!matchingMetadataExists) {
          const cleanup = await db.storage.from(NURSE_INVOICE_RECEIPT_BUCKET).remove([storagePath]);
          if (cleanup.error) {
            throw Object.assign(new Error('Receipt metadata failed and uploaded object cleanup failed.'), {
              code: 'receipt_orphan_cleanup_failed',
              cause: metadataError,
            });
          }
        }
        throw metadataError;
      }
    }

    const update = await db.from('nurse_invoices').update({ receipt_storage_status: 'complete' })
      .eq('tenant_id', tenantId).eq('id', invoiceId);
    if (update.error) throw update.error;
    return { status: 'complete', rows };
  } catch (error) {
    await db.from('nurse_invoices').update({ receipt_storage_status: 'failed' })
      .eq('tenant_id', tenantId).eq('id', invoiceId);
    return { status: 'failed', rows, error };
  }
}

export async function receiptsWithSignedUrls(db, rows, expiresIn = 300) {
  return Promise.all((rows || []).map(async (row) => {
    const scanStatus = row.scan_status || 'quarantined';
    if (scanStatus !== 'cleared') {
      return {
        id: row.id,
        fileName: row.file_name,
        contentType: row.content_type,
        byteSize: Number(row.byte_size || 0),
        checksumSha256: row.checksum_sha256,
        scanStatus,
        signedUrl: null,
      };
    }
    const signed = await db.storage.from(NURSE_INVOICE_RECEIPT_BUCKET)
      .createSignedUrl(row.storage_path, expiresIn, { download: row.file_name });
    return {
      id: row.id,
      fileName: row.file_name,
      contentType: row.content_type,
      byteSize: Number(row.byte_size || 0),
      checksumSha256: row.checksum_sha256,
      scanStatus,
      signedUrl: signed.error ? null : signed.data?.signedUrl || null,
    };
  }));
}
