---
name: Arabic PDF rendering with jsPDF
description: How to render readable Arabic text in PDFs for the china-import-tracker project.
---

## Chosen Approach: html2canvas + jsPDF

**Do NOT use jsPDF text rendering for Arabic.** Even with embedded fonts (Cairo TTF), Arabic requires OpenType shaping that jsPDF cannot do. This produces garbled or disconnected letters.

**The correct approach:**
1. Build an off-screen HTML `div` (positioned at `left:-9999px`) with `direction:rtl` and any Arabic-capable font in `font-family`.
2. Render it with `html2canvas({ scale:2, backgroundColor:'#ffffff' })` — the browser's own text engine handles shaping correctly.
3. Convert the canvas to JPEG with `canvas.toDataURL('image/jpeg', 0.92)`.
4. Embed in jsPDF with `doc.addImage(imgData, 'JPEG', x, y, w, h)`.

**Why:** The browser's native text engine correctly applies OpenType shaping, RTL bidirectionality, and Arabic contextual forms. html2canvas captures the rendered pixels exactly. No font embedding, no reshaping library needed.

**Number formatting:** Use `en-US` locale (`num.toLocaleString('en-US', ...)`) for numbers in PDFs. `ar-SA` produces Arabic-Indic digits that may not align well in the captured HTML.

## Excel (SheetJS)

xlsx (SheetJS) with `bookType:'xlsx', type:'array'` handles Arabic UTF-8 natively — no special encoding needed. The `.xlsx` format is internally XML with UTF-8. Arabic strings pass through correctly.

## How to apply

- `mkContainer(widthPx)`: creates the off-screen element, appends to body
- `pagesToPDF(pages, filename, orientation)`: renders each element as a PDF page, saves
- All PDF functions are `async` (they await `html2canvas`)
- Page callers use `await` or `.catch(console.error)` for inline buttons
