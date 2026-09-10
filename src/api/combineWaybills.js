import { PDFDocument } from "pdf-lib";

/**
 * Lay out individual PUDO sticker PDFs on A4 pages, 2 columns × 3 rows.
 * @param {ArrayBuffer[]|Uint8Array[]} pdfBuffers
 * @returns {Promise<Uint8Array>}
 */
export async function combineWaybillPdfs(pdfBuffers) {
  const A4_W = 595.28;
  const A4_H = 841.89;
  const COLS = 2;
  const ROWS = 3;
  const WAYBILLS_PER_PAGE = COLS * ROWS;
  const SLOT_W = A4_W / COLS;
  const SLOT_H = A4_H / ROWS;

  const combinedDoc = await PDFDocument.create();

  for (let pageStart = 0; pageStart < pdfBuffers.length; pageStart += WAYBILLS_PER_PAGE) {
    const chunk = pdfBuffers.slice(pageStart, pageStart + WAYBILLS_PER_PAGE);
    const page = combinedDoc.addPage([A4_W, A4_H]);

    for (let i = 0; i < chunk.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const slotX = col * SLOT_W;
      const slotY = A4_H - (row + 1) * SLOT_H;

      const waybillDoc = await PDFDocument.load(chunk[i]);
      const [embeddedPage] = await combinedDoc.embedPdf(waybillDoc);
      const { width: origW, height: origH } = embeddedPage;
      const scale = Math.min(SLOT_W / origW, SLOT_H / origH);
      const scaledW = origW * scale;
      const scaledH = origH * scale;

      page.drawPage(embeddedPage, {
        x: slotX + (SLOT_W - scaledW) / 2,
        y: slotY + (SLOT_H - scaledH) / 2,
        width: scaledW,
        height: scaledH,
      });
    }
  }

  return combinedDoc.save();
}

export function waybillFilename(shipments) {
  const firstName = shipments[0]?.trackingRef || String(shipments[0]?.shipmentId);
  return shipments.length === 1
    ? `${firstName}.pdf`
    : `waybills_${firstName}_+${shipments.length - 1}.pdf`;
}
