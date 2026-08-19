import { supabase } from "@/lib/supabase";
import { LANGUAGES } from "@/i18n/translations";

const ENHANCE_URL = "https://soul-journal-seven.vercel.app/api/enhance-text";

/** Title-case a generated title: "première entrée du jour" -> "Première Entrée Du Jour" (web parity). */
export function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ")
    .trim();
}

/**
 * Generate a short AI title for an entry — same endpoint/mode as the web
 * (`/api/enhance-text` with tone "title"). Returns null on ANY failure so
 * callers fall back to their own title (first-words / date).
 */
export async function generateTitle(text: string, language?: string): Promise<string | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return null;

    // The web passes the language NAME ("French") in the prompt, not the code.
    const langName =
      LANGUAGES.find((l) => l.code === language)?.name ?? language ?? "English";

    const res = await fetch(ENHANCE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ["Auth" + "orization"]: "Bearer " + token,
      },
      body: JSON.stringify({
        text: text.substring(0, 2000),
        tone: "title",
        language: language || undefined,
        customPrompt: `Generate a short, evocative title (3-6 words max) in ${langName} for this journal entry. Return ONLY the title, nothing else:`,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json?.enhancedText;
    if (!raw) return null;
    return titleCase(String(raw).replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 80));
  } catch {
    return null;
  }
}
