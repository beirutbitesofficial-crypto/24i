import { describe, expect, it } from "vitest";
import { detectDirection, layoutText, splitRuns } from "./bidi-text";

const S1 = "مرحبا، my name is Firas وأنا أستخدم Teleprompter لتصوير الفيديو.";
const S2 = "اليوم عندي video recording الساعة 5:30 PM، وبعدها بدي أعمل editing.";
const join = (text: string) => layoutText(text).map((p) => p.runs.map((r) => r.text).join("")).join("\n");
const isolates = (text: string) => layoutText(text)[0].runs.filter((r) => r.isolate).map((r) => r.text);

describe("bidi text", () => {
  it("never changes the text: runs join back to the exact original", () => {
    for (const t of [S1, S2, "English first, ثم عربي (with brackets) 😀 100%", "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", "", "  ", "123 456", `${S1}\n\n${S2}`]) {
      expect(join(t)).toBe(t);
    }
  });

  it("detects paragraph direction from the first strong character (UAX #9 P2/P3)", () => {
    expect(detectDirection(S1)).toBe("rtl");
    expect(detectDirection(S2)).toBe("rtl");
    expect(detectDirection("Hello مرحبا")).toBe("ltr");
    expect(detectDirection("123 — مرحبا")).toBe("rtl");
    expect(detectDirection("😀 123")).toBe("ltr");
    expect(detectDirection("َمرحبا")).toBe("rtl"); // a leading tashkeel mark is not strong
  });

  it("isolates the English runs of sentence 1 and keeps punctuation outside", () => {
    expect(isolates(S1)).toEqual(["my name is Firas", "Teleprompter"]);
  });

  it("keeps a time with its English unit and leaves the Arabic comma and full stop in place", () => {
    expect(isolates(S2)).toEqual(["video recording", "5:30 PM", "editing"]);
    const runs = layoutText(S2)[0].runs;
    expect(runs[runs.length - 1]).toMatchObject({ text: ".", isolate: false });
    expect(runs.find((r) => r.text.startsWith("،"))?.isolate).toBe(false);
  });

  it("isolates Arabic inside an English paragraph", () => {
    const [p] = layoutText("Today I will say مرحبا بكم to everyone.");
    expect(p.dir).toBe("ltr");
    expect(p.runs.filter((r) => r.isolate).map((r) => r.text)).toEqual(["مرحبا بكم"]);
  });

  it("keeps tashkeel attached to its letters", () => {
    const t = "Read: السَّلَامُ عَلَيْكُمْ now";
    expect(splitRuns(t, "ltr").filter((r) => r.isolate).map((r) => r.text)).toEqual(["السَّلَامُ عَلَيْكُمْ"]);
  });

  it("keeps a closing bracket with its English run", () => {
    expect(isolates("استخدم (Teleprompter) دائماً")).toEqual(["Teleprompter"]);
    expect(isolates("استخدم (Teleprompter app) دائماً")).toEqual(["Teleprompter app"]);
  });

  it("honours a manual direction override", () => {
    expect(layoutText(S1, "ltr")[0].dir).toBe("ltr");
    expect(join(S1)).toBe(S1);
  });
});
