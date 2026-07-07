---
name: Arabic PDF rendering with jsPDF
description: How to render readable Arabic text in jsPDF for the china-import-tracker project, including font loading, reshaping, and number formatting.
---

## The Rule

1. **Font**: Embed Cairo TTF (Regular + Bold) via `doc.addFileToVFS` + `doc.addFont`. Fetch from `/fonts/Cairo-*.ttf`, cache base64 at module scope. Helvetica has no Arabic glyph coverage.

2. **Text reshaping**: Call `ar(text)` from `src/lib/arabicReshaper.ts` on every Arabic string before passing to jsPDF. The reshaper converts Unicode letters to contextual presentation forms (U+FE70-U+FEFF), applies mandatory Lam-Alef ligatures, and reverses the string for LTR rendering.

3. **Number formatting**: `formatNumber()` uses `ar-SA` locale → Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) that show as garbled chars in Helvetica. Use a `fmt()` helper with `en-US` locale for all PDF numeric values. `formatNumber()` is correct for on-screen display.

4. **Table styles**: In jsPDF-autotable, set `styles: { font: 'Cairo' }` on every table. Set `halign: 'right'` on cells containing Arabic user data.

5. **Async**: All PDF export functions must be `async` (they await the font loader). Page callers use `await` or `.catch(console.error)` on single-item inline buttons.

**Why:** Helvetica encodes Arabic codepoints as WinAnsi bytes, mapping them to random Latin glyphs (produces `þæþô...` or `ikd\`` garbage). Arabic-Indic digits from `ar-SA` locale are also in the Arabic Unicode range, causing the same encoding failure.

## Reshaper correctness rules (arabicReshaper.ts)

- `rightConn = isDual(prevCh)` — ONLY dual-joining (D-type) prev letters provide a right connection. R-type letters (alef ا, waw و, ra ر, dal د, etc.) cannot extend leftward, so letters after them must be INITIAL or ISOLATED.
- `isDual()` excludes both `RIGHT_ONLY` set AND `NON_JOINING` set (currently: ء hamza).
- ء (U+0621 hamza standalone) is NON_JOINING (U-type): must be in `NON_JOINING` set so adjacent letters are not drawn connecting through it.
- Lam-Alef ligature selection also uses `isDual(prevCh)` (same rule as rightConn).

**How to apply:** Any future edits to arabicReshaper.ts must preserve the isDual-based rightConn. The naive isJoinable-based approach incorrectly joins after R-type letters.
