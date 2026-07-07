/**
 * Arabic text reshaper for jsPDF
 *
 * Converts Arabic Unicode text (logical order, U+0600–U+06FF) into
 * Arabic Presentation Forms (U+FE70–U+FEFF) with the correct contextual
 * glyph shape (isolated / final / initial / medial), then reverses the
 * result so that jsPDF's LTR renderer displays it correctly right-to-left.
 *
 * Algorithm summary
 * -----------------
 * Arabic letters are stored in logical order (first letter = visual right).
 * For each letter at index i:
 *   • prev = chars[i-1]  → the letter that appears to the visual RIGHT
 *   • next = chars[i+1]  → the letter that appears to the visual LEFT
 *
 * right_conn (current connects to the letter on its visual right):
 *   current is joinable (D or R type) AND prev is any joinable Arabic letter
 *
 * left_conn (current extends toward the letter on its visual left):
 *   current is dual-joining (D type) AND next is any joinable Arabic letter
 *
 * form = medial  ← both connections active
 *        final   ← only right connection
 *        initial ← only left connection
 *        isolated← neither
 *
 * Special: mandatory Lam-Alef ligature when ل precedes ا/أ/إ/آ.
 */

// [isolated, final, initial, medial]
type Forms = readonly [string, string, string, string];

const LETTER_FORMS: Record<string, Forms> = {
  '\u0621': ['\uFE80', '\uFE80', '\uFE80', '\uFE80'], // ء Hamza (non-joining)
  '\u0622': ['\uFE81', '\uFE82', '\uFE81', '\uFE82'], // آ Alef madda (R)
  '\u0623': ['\uFE83', '\uFE84', '\uFE83', '\uFE84'], // أ Alef hamza above (R)
  '\u0624': ['\uFE85', '\uFE86', '\uFE85', '\uFE86'], // ؤ Waw hamza (R)
  '\u0625': ['\uFE87', '\uFE88', '\uFE87', '\uFE88'], // إ Alef hamza below (R)
  '\u0626': ['\uFE89', '\uFE8A', '\uFE8B', '\uFE8C'], // ئ Ya hamza (D)
  '\u0627': ['\uFE8D', '\uFE8E', '\uFE8D', '\uFE8E'], // ا Alef (R)
  '\u0628': ['\uFE8F', '\uFE90', '\uFE91', '\uFE92'], // ب Ba (D)
  '\u0629': ['\uFE93', '\uFE94', '\uFE93', '\uFE94'], // ة Ta marbuta (R)
  '\u062A': ['\uFE95', '\uFE96', '\uFE97', '\uFE98'], // ت Ta (D)
  '\u062B': ['\uFE99', '\uFE9A', '\uFE9B', '\uFE9C'], // ث Tha (D)
  '\u062C': ['\uFE9D', '\uFE9E', '\uFE9F', '\uFEA0'], // ج Jim (D)
  '\u062D': ['\uFEA1', '\uFEA2', '\uFEA3', '\uFEA4'], // ح Ha (D)
  '\u062E': ['\uFEA5', '\uFEA6', '\uFEA7', '\uFEA8'], // خ Kha (D)
  '\u062F': ['\uFEA9', '\uFEAA', '\uFEA9', '\uFEAA'], // د Dal (R)
  '\u0630': ['\uFEAB', '\uFEAC', '\uFEAB', '\uFEAC'], // ذ Thal (R)
  '\u0631': ['\uFEAD', '\uFEAE', '\uFEAD', '\uFEAE'], // ر Ra (R)
  '\u0632': ['\uFEAF', '\uFEB0', '\uFEAF', '\uFEB0'], // ز Zain (R)
  '\u0633': ['\uFEB1', '\uFEB2', '\uFEB3', '\uFEB4'], // س Sin (D)
  '\u0634': ['\uFEB5', '\uFEB6', '\uFEB7', '\uFEB8'], // ش Shin (D)
  '\u0635': ['\uFEB9', '\uFEBA', '\uFEBB', '\uFEBC'], // ص Sad (D)
  '\u0636': ['\uFEBD', '\uFEBE', '\uFEBF', '\uFEC0'], // ض Dad (D)
  '\u0637': ['\uFEC1', '\uFEC2', '\uFEC3', '\uFEC4'], // ط Ta heavy (D)
  '\u0638': ['\uFEC5', '\uFEC6', '\uFEC7', '\uFEC8'], // ظ Dha (D)
  '\u0639': ['\uFEC9', '\uFECA', '\uFECB', '\uFECC'], // ع Ain (D)
  '\u063A': ['\uFECD', '\uFECE', '\uFECF', '\uFED0'], // غ Ghain (D)
  '\u0641': ['\uFED1', '\uFED2', '\uFED3', '\uFED4'], // ف Fa (D)
  '\u0642': ['\uFED5', '\uFED6', '\uFED7', '\uFED8'], // ق Qaf (D)
  '\u0643': ['\uFED9', '\uFEDA', '\uFEDB', '\uFEDC'], // ك Kaf (D)
  '\u0644': ['\uFEDD', '\uFEDE', '\uFEDF', '\uFEE0'], // ل Lam (D)
  '\u0645': ['\uFEE1', '\uFEE2', '\uFEE3', '\uFEE4'], // م Meem (D)
  '\u0646': ['\uFEE5', '\uFEE6', '\uFEE7', '\uFEE8'], // ن Noon (D)
  '\u0647': ['\uFEE9', '\uFEEA', '\uFEEB', '\uFEEC'], // ه Ha (D)
  '\u0648': ['\uFEED', '\uFEEE', '\uFEED', '\uFEEE'], // و Waw (R)
  '\u0649': ['\uFEEF', '\uFEF0', '\uFEEF', '\uFEF0'], // ى Alef maqsura (R)
  '\u064A': ['\uFEF1', '\uFEF2', '\uFEF3', '\uFEF4'], // ي Ya (D)
  // Extended Arabic letters
  '\u0671': ['\uFB50', '\uFB51', '\uFB50', '\uFB51'], // ٱ Alef wasla (R)
  '\u067E': ['\uFB56', '\uFB57', '\uFB58', '\uFB59'], // پ Pe (D)
  '\u0686': ['\uFB7A', '\uFB7B', '\uFB7C', '\uFB7D'], // چ Cheh (D)
  '\u06A9': ['\uFB8E', '\uFB8F', '\uFB90', '\uFB91'], // ک Keheh (D)
  '\u06AF': ['\uFB92', '\uFB93', '\uFB94', '\uFB95'], // گ Gaf (D)
};

// Right-joining only letters (R-type): only have isolated and final forms
const RIGHT_ONLY = new Set([
  '\u0621', // ء Hamza
  '\u0622', // آ Alef madda
  '\u0623', // أ Alef hamza above
  '\u0624', // ؤ Waw hamza
  '\u0625', // إ Alef hamza below
  '\u0627', // ا Alef
  '\u0629', // ة Ta marbuta
  '\u062F', // د Dal
  '\u0630', // ذ Thal
  '\u0631', // ر Ra
  '\u0632', // ز Zain
  '\u0648', // و Waw
  '\u0649', // ى Alef maqsura
  '\u0671', // ٱ Alef wasla
]);

// Mandatory Lam-Alef ligature: when ل (U+0644) is followed by an Alef variant
// [isolated ligature, final ligature]
const LAM_ALEF: Record<string, readonly [string, string]> = {
  '\u0622': ['\uFEF5', '\uFEF6'], // آ
  '\u0623': ['\uFEF7', '\uFEF8'], // أ
  '\u0625': ['\uFEF9', '\uFEFA'], // إ
  '\u0627': ['\uFEFB', '\uFEFC'], // ا
  '\u0671': ['\uFEFB', '\uFEFC'], // ٱ (treat like ا)
};

// Arabic diacritics (tashkeel) — transparent, don't affect joining
function isDiacritic(cp: number): boolean {
  return cp >= 0x064B && cp <= 0x065F;
}

// Non-joining characters (despite being "Arabic" in block range)
// ء Hamza is U-type (non-joining): does NOT connect to either neighbour
const NON_JOINING = new Set(['\u0621']); // ء

/**
 * Returns true if `ch` can participate in joining (D or R type).
 * Non-joining characters like ء are excluded.
 */
function isJoinable(ch: string): boolean {
  return ch in LETTER_FORMS && !NON_JOINING.has(ch);
}

/**
 * Returns true if `ch` is dual-joining (D-type): can extend toward BOTH
 * neighbours. Only D-type letters generate the "previous letter can connect
 * leftward toward me" condition. R-type and non-joining are excluded.
 */
function isDual(ch: string): boolean {
  return isJoinable(ch) && !RIGHT_ONLY.has(ch);
}

/**
 * Reshape Arabic text and reverse for LTR rendering in jsPDF.
 * Non-Arabic segments (numbers, Latin) are preserved and positioned correctly
 * within each segment after reversal.
 */
export function ar(text: string): string {
  if (!text) return text;
  // Fast path: skip if no Arabic
  if (!/[\u0600-\u06FF]/.test(text)) return text;

  const chars = [...text];
  const shaped: string[] = [];
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i];
    const cp = ch.codePointAt(0)!;

    // Diacritics pass through
    if (isDiacritic(cp)) {
      shaped.push(ch);
      i++;
      continue;
    }

    // Mandatory Lam-Alef ligature
    if (ch === '\u0644') {
      // Look ahead skipping diacritics
      let nj = i + 1;
      while (nj < chars.length && isDiacritic(chars[nj].codePointAt(0)!)) nj++;
      const nextCh = nj < chars.length ? chars[nj] : '';
      if (nextCh && nextCh in LAM_ALEF) {
        // Collect any diacritics between lam and alef
        const diacritics = chars.slice(i + 1, nj).join('');
        // Determine if lam receives a right-connection (from logical prev)
        let pi = i - 1;
        while (pi >= 0 && isDiacritic(chars[pi].codePointAt(0)!)) pi--;
        const prevCh = pi >= 0 ? chars[pi] : '';
        // Lam gets FINAL ligature only if prev is a dual-joining letter (D-type)
        // that can extend leftward toward lam. R-type letters (alef, waw, etc.)
        // cannot extend left, so they do NOT produce a right-connection for lam.
        const hasRight = isDual(prevCh);
        const [isoLig, finLig] = LAM_ALEF[nextCh];
        shaped.push(diacritics, hasRight ? finLig : isoLig);
        i = nj + 1;
        continue;
      }
    }

    // Non-Arabic / unknown pass through
    if (!(ch in LETTER_FORMS)) {
      shaped.push(ch);
      i++;
      continue;
    }

    // Find effective prev (skip diacritics)
    let pi = i - 1;
    while (pi >= 0 && isDiacritic(chars[pi].codePointAt(0)!)) pi--;
    const prevCh = pi >= 0 ? chars[pi] : '';

    // Find effective next (skip diacritics)
    let ni = i + 1;
    while (ni < chars.length && isDiacritic(chars[ni].codePointAt(0)!)) ni++;
    const nextCh = ni < chars.length ? chars[ni] : '';

    // right_conn: current connects to its visual-right neighbour (logical prev).
    // Requires prev to be DUAL-JOINING (D-type): only D-type letters extend
    // leftward toward the current letter. R-type letters (alef, waw, ra, etc.)
    // can only connect rightward (toward the word start) so they do NOT provide
    // a right-connection for the letter that follows them logically.
    const rightConn = isDual(prevCh);
    // left_conn:  current extends toward its visual-left neighbour (logical next)
    const leftConn = isDual(ch) && isJoinable(nextCh);

    const [iso, fin, ini, med] = LETTER_FORMS[ch];
    let form: string;
    if (rightConn && leftConn) form = med;
    else if (rightConn) form = fin;
    else if (leftConn) form = ini;
    else form = iso;

    shaped.push(form);
    i++;
  }

  // Reverse the visual order for LTR rendering.
  // We reverse whole segments: Arabic runs get reversed, non-Arabic runs stay
  // in place but their position in the string is reversed relative to Arabic.
  return segmentReverse(shaped.join(''));
}

/**
 * Reverse the string segment-by-segment so that:
 * - Arabic / presentation-form runs are reversed (RTL content)
 * - Non-Arabic runs (digits, Latin, punctuation) are kept in internal order
 *   but repositioned according to the reversed surrounding context.
 *
 * For mostly-Arabic text this is equivalent to a full reversal.
 */
function segmentReverse(text: string): string {
  // Split into alternating Arabic and non-Arabic segments
  const segments: string[] = [];
  let buf = '';
  let inArabic: boolean | null = null;

  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const isAr =
      (cp >= 0x0600 && cp <= 0x06FF) ||
      (cp >= 0xFB50 && cp <= 0xFDFF) ||
      (cp >= 0xFE70 && cp <= 0xFEFF);

    if (inArabic === null) inArabic = isAr;
    if (isAr !== inArabic) {
      segments.push(buf);
      buf = '';
      inArabic = isAr;
    }
    buf += ch;
  }
  if (buf) segments.push(buf);

  // Reverse the segment order; reverse each Arabic segment internally
  return segments
    .reverse()
    .map((seg) => {
      const cp0 = seg.codePointAt(0)!;
      const isAr =
        (cp0 >= 0x0600 && cp0 <= 0x06FF) ||
        (cp0 >= 0xFB50 && cp0 <= 0xFDFF) ||
        (cp0 >= 0xFE70 && cp0 <= 0xFEFF);
      return isAr ? [...seg].reverse().join('') : seg;
    })
    .join('');
}
