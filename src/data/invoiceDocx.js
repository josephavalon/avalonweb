/**
 * A real .docx, built by hand.
 *
 * The previous download was HTML served as application/msword. Word tolerates
 * that; LibreOffice sniffs the bytes, decides it is text, and shows the nurse a
 * page of raw markup. A .docx is a ZIP of three small XML files, so producing a
 * genuine one is cheaper than shipping a document library to every phone.
 *
 * Entries are STORED, not deflated. Nothing here is big enough for compression
 * to matter, and STORE means no zlib and no CompressionStream — this runs the
 * same in a browser and in Node.
 *
 * Deliberately plain: headings, labelled lines, one bordered table. An invoice
 * has to be readable and printable, not art-directed.
 */

const encoder = new TextEncoder();

function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// --- ZIP --------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * A fixed timestamp rather than "now": two downloads of the same invoice should
 * be byte-identical, which makes them comparable and the output testable.
 * 2020-01-01 00:00:00 in DOS date/time.
 */
const DOS_TIME = 0;
const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;

function zip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  const push = (bytes) => {
    chunks.push(bytes);
    offset += bytes.length;
  };

  const u16 = (v) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
  const u32 = (v) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
  const join = (...parts) => {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  };

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const localOffset = offset;

    push(join(
      u32(0x04034b50), u16(20), u16(0), u16(0), // signature, version, flags, STORE
      u16(DOS_TIME), u16(DOS_DATE),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0),
      name,
    ));
    push(data);

    central.push(join(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0),
      u16(DOS_TIME), u16(DOS_DATE),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(localOffset),
      name,
    ));
  }

  const centralOffset = offset;
  for (const entry of central) push(entry);
  const centralSize = offset - centralOffset;

  push(join(
    u32(0x06054b50), u16(0), u16(0),
    u16(files.length), u16(files.length),
    u32(centralSize), u32(centralOffset), u16(0),
  ));

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

// --- WordprocessingML -------------------------------------------------------

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function para(text, { bold = false, size = 20, after = 100, align = 'left' } = {}) {
  // Word sizes are half-points; 20 = 10pt.
  return `<w:p><w:pPr><w:spacing w:after="${after}"/><w:jc w:val="${align}"/></w:pPr>`
    + `<w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/></w:rPr>`
    + `<w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}

function cell(text, { bold = false, align = 'left', width = 1500 } = {}) {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>`
    + `<w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="${align}"/></w:pPr>`
    + `<w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="18"/></w:rPr>`
    + `<w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p></w:tc>`;
}

function table(rows, widths) {
  const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((side) => `<w:${side} w:val="single" w:sz="4" w:color="BFBFBF"/>`)
    .join('');
  const body = rows
    .map((row) => `<w:tr>${row.cells.map((c, i) => cell(c.text, { ...c, width: widths[i] })).join('')}</w:tr>`)
    .join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr>${body}</w:tbl>`;
}

/** Returns a Uint8Array of a .docx file. */
export function buildInvoiceDocx({
  nurse,
  invoiceNumber,
  periodStart,
  periodEnd,
  computed,
  submittedAt,
  receiptCount = 0,
  money,
  moneyPlain,
}) {
  const shiftRows = [
    {
      cells: [
        { text: 'Date', bold: true },
        { text: 'Type', bold: true },
        { text: 'Hours', bold: true, align: 'right' },
        { text: 'IV', bold: true, align: 'right' },
        { text: 'Shot', bold: true, align: 'right' },
        { text: 'GFE', bold: true, align: 'right' },
        { text: 'Amount', bold: true, align: 'right' },
      ],
    },
    ...computed.shiftLines.map((line) => ({
      cells: [
        { text: line.date },
        { text: line.typeLabel },
        { text: line.hours.toFixed(2), align: 'right' },
        { text: line.ivCount ? String(line.ivCount) : '-', align: 'right' },
        { text: line.shotCount ? String(line.shotCount) : '-', align: 'right' },
        { text: line.gfeCount ? String(line.gfeCount) : '-', align: 'right' },
        { text: money(line.subtotalCents), align: 'right' },
      ],
    })),
  ];

  const expenseRows = [
    {
      cells: [
        { text: 'Expense', bold: true },
        { text: 'Amount', bold: true, align: 'right' },
      ],
    },
    ...(computed.expenseLines.length
      ? computed.expenseLines.map((line) => ({
          cells: [{ text: line.description }, { text: money(line.amountCents), align: 'right' }],
        }))
      : [{ cells: [{ text: 'None' }, { text: money(0), align: 'right' }] }]),
  ];

  const body = [
    para('AVALON VITALITY', { bold: true, size: 16, after: 40 }),
    para(`Contractor invoice - ${nurse.name}`, { bold: true, size: 32, after: 60 }),
    para(
      `${periodStart} to ${periodEnd}${nurse.role ? `   ${nurse.role}` : ''}`,
      { size: 18, after: 240 },
    ),

    para('For Gusto: Pay > US contractors > New payment', { bold: true, size: 18, after: 60 }),
    para(`Contractor: ${nurse.name}`, { size: 20, after: 40 }),
    para(`Invoice: ${invoiceNumber}`, { size: 20, after: 40 }),
    para(`Wage: ${moneyPlain(computed.wagesCents)}`, { size: 20, after: 40 }),
    para(`Reimbursement: ${moneyPlain(computed.reimbursementsCents)}`, { size: 20, after: 40 }),
    para(`Total: ${moneyPlain(computed.grandTotalCents)}`, { bold: true, size: 20, after: 240 }),

    para('Shifts', { bold: true, size: 22, after: 80 }),
    table(shiftRows, [1300, 1500, 800, 600, 600, 600, 1200]),
    para('', { after: 200 }),

    para('Expenses', { bold: true, size: 22, after: 80 }),
    table(expenseRows, [5400, 1200]),
    para('', { after: 200 }),

    para(`Wages: ${money(computed.wagesCents)}`, { size: 20, after: 40 }),
    para(`Reimbursements: ${money(computed.reimbursementsCents)}`, { size: 20, after: 40 }),
    para(`TOTAL: ${money(computed.grandTotalCents)}`, { bold: true, size: 26, after: 240 }),

    receiptCount
      ? para(
          `${receiptCount} receipt${receiptCount === 1 ? '' : 's'} were attached to the emailed copy.`,
          { size: 16, after: 60 },
        )
      : '',
    para(`Submitted ${submittedAt} and confirmed accurate by the contractor.`, { size: 16, after: 40 }),
    para('Totals are calculated server-side from the entered shifts.', { size: 16, after: 0 }),
  ].join('');

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

  return zip([
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rels },
    { name: 'word/document.xml', content: document },
  ]);
}

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
