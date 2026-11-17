// Bidirectional (Arabic / English) text helpers for the teleprompter.
//
// Nothing here reorders or reverses characters. Display order is left entirely to the
// browser's implementation of the Unicode Bidirectional Algorithm (UAX #9), and Arabic
// shaping (joining forms, ligatures, tashkeel placement) to its text shaper. This module
// only decides, per paragraph, the base direction (UAX #9 rules P2/P3: first strong
// character), and splits each paragraph into runs so that text in the *other* direction
// can be wrapped in a directional isolate (<bdi>). Joining the runs always gives back the
// exact original string, so copying, editing and saving never change the text.

export type Direction = "ltr" | "rtl";
export type RunScript = "rtl" | "ltr" | "neutral";
export type Run = { text: string; isolate: boolean; dir: Direction; script: RunScript };
export type Paragraph = { text: string; dir: Direction; runs: Run[] };

// Right-to-left scripts. Letters only: Arabic-Indic digits are numbers (AN/EN), and
// combining marks (tashkeel) are NSM, so they are handled separately below.
const RTL_LETTER = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Samaritan}\p{Script=Mandaic}\p{Script=Adlam}]/u;
const LETTER = /[\p{L}\p{Mc}]/u;
const MARK = /\p{M}/u;
const DIGIT = /\p{Nd}/u;
const SPACE = /\s/u;
// Separators that belong inside a number or between foreign words ("5:30", "1,000", "e-mail").
const INNER = /[\p{Nd}:.,\/\-+%'’_&@#]/u;
const OPENERS: Record<string, string> = { "(": ")", "[": "]", "{": "}", "«": "»", "“": "”", "‘": "’", "\"": "\"" };

export function charDirection(ch: string): Direction | null {
  if (MARK.test(ch)) return null;
  if (RTL_LETTER.test(ch) && LETTER.test(ch)) return "rtl";
  // RTL scripts also contain a few strong punctuation characters (e.g. ؟ U+061F is AL).
  if (ch === "؟" || ch === "؛" || ch === "۔") return "rtl";
  if (LETTER.test(ch)) return "ltr";
  if (ch === "‏" || ch === "؜") return "rtl"; // RLM, ALM
  if (ch === "‎") return "ltr"; // LRM
  return null;
}

// UAX #9 P2/P3: the paragraph direction is that of its first strong character.
export function detectDirection(text: string, fallback: Direction = "ltr"): Direction {
  for (const ch of text) {
    const d = charDirection(ch);
    if (d) return d;
  }
  return fallback;
}

function scriptOf(text: string): RunScript {
  for (const ch of text) {
    const d = charDirection(ch);
    if (d) return d;
  }
  return "neutral";
}

// Splits one paragraph into runs. A foreign run starts at the first character of the other
// direction (pulling in a number that leads into it, e.g. "5:30 PM") and ends at its last
// letter, digit or mark, plus a closing bracket whose opener is inside the run. Trailing
// punctuation and spaces stay with the surrounding text, so a full stop or Arabic comma
// after an English word keeps its place in the sentence.
export function splitRuns(text: string, base: Direction): Run[] {
  const chars = Array.from(text);
  const foreign: Direction = base === "rtl" ? "ltr" : "rtl";
  const dirs = chars.map(charDirection);
  const marks: boolean[] = new Array(chars.length).fill(false); // true = inside a foreign run

  let i = 0;
  while (i < chars.length) {
    if (dirs[i] !== foreign) { i++; continue; }
    // Extend backwards over a number that leads into this run: "الساعة 5:30 PM".
    let start = i;
    let j = i - 1;
    while (j >= 0 && SPACE.test(chars[j])) j--;
    if (j >= 0 && DIGIT.test(chars[j]) && !marks[j]) {
      let k = j;
      while (k > 0 && INNER.test(chars[k - 1]) && !marks[k - 1]) k--;
      while (k < j && !DIGIT.test(chars[k])) k++; // start at the number's first digit
      // Only when the number stands on its own, not glued to a native letter.
      if (k === 0 || dirs[k - 1] === null) start = k;
    }
    // Extend forwards while the next strong character is still foreign.
    let end = i; // inclusive
    let k = i + 1;
    while (k < chars.length) {
      const d = dirs[k];
      if (d === base) break;
      if (d === foreign || MARK.test(chars[k]) || DIGIT.test(chars[k])) end = k;
      k++;
    }
    // Keep a closing bracket/quote whose opener is inside the run.
    if (end + 1 < chars.length) {
      const stack: string[] = [];
      for (let m = start; m <= end; m++) {
        if (OPENERS[chars[m]] && chars[m] !== "\"") stack.push(OPENERS[chars[m]]);
        else if (stack.length && chars[m] === stack[stack.length - 1]) stack.pop();
      }
      if (stack.length && chars[end + 1] === stack[stack.length - 1]) end += 1;
    }
    for (let m = start; m <= end; m++) marks[m] = true;
    i = end + 1;
  }

  const runs: Run[] = [];
  let buf = "";
  let cur: boolean | null = null;
  const flush = () => {
    if (!buf) return;
    runs.push({ text: buf, isolate: !!cur, dir: cur ? foreign : base, script: scriptOf(buf) });
    buf = "";
  };
  chars.forEach((ch, idx) => {
    if (cur !== null && marks[idx] !== cur) flush();
    cur = marks[idx];
    buf += ch;
  });
  flush();
  return runs;
}

export function layoutText(text: string, override: Direction | "auto" = "auto", fallback: Direction = "ltr"): Paragraph[] {
  // Normalise line endings only; the characters themselves are never touched.
  return text.replace(/\r\n?/g, "\n").split("\n").map((line) => {
    const dir = override === "auto" ? detectDirection(line, fallback) : override;
    return { text: line, dir, runs: splitRuns(line, dir) };
  });
}
