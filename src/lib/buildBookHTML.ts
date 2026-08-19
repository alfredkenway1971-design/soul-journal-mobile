/**
 * Soul Book Builder — HTML generation for expo-print (mobile port of the web's
 * generateBookPDF.ts). Produces a single continuous A5 HTML document (cover,
 * entry pages, back cover) that expo-print converts to a PDF, plus a
 * fixed-420px single-page variant for the in-app WebView preview.
 *
 * Physical-size parity: the web renders each page at 384dpi (SCALE=4) onto an
 * A5 canvas, so every web px value is divided by 4 and re-mapped to 96dpi px
 * (factor 0.2646) to land on the same physical size in print.
 * Ported 2026-08-19.
 */
import {
  BookConfig, JournalEntry, CoverTemplate, PhotoSize, EntryLayout, PageBackground,
  COVER_GRADIENTS, COVER_TEXT_COLORS, isLightCover, MIDNIGHT_STARS,
  getFontSizePx, getCoverFontSizes, getPhotoDimensions, escMultiline, smartTitleCase, isRTLText,
  getBookFontConfig,
} from "@/lib/bookTypes";

export interface BookScale {
  /** Scale a web 4x px value to this output's px (96dpi print or 420px preview). */
  px: (webPx: number) => number;
  pageW: number | string;
  pageH: number | string;
  /** CSS unit suffix for fixed-size pages ("" for px, or use vh/100%). */
  fixed: boolean;
}

export const PDF_SCALE: BookScale = {
  px: (n) => Math.round(n * 0.2646 * 10) / 10, // web 4x px -> 96dpi px (same physical mm)
  pageW: "100%",
  pageH: "100vh",
  fixed: false,
};

export const PREVIEW_SCALE: BookScale = {
  px: (n) => Math.round(n * 0.1877 * 10) / 10, // 420px wide preview canvas (420px ≈ 148mm)
  pageW: 420,
  pageH: 595,
  fixed: true,
};

/* ── Image helpers (RN fetch → blob → FileReader base64) ── */

export const imageToBase64 = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("imageToBase64 failed, falling back to raw URL:", url, e);
    return url;
  }
};

export const preloadEntryImages = async (entries: JournalEntry[]): Promise<JournalEntry[]> =>
  Promise.all(
    entries.map(async (entry) => {
      if (!entry.photoUrls || entry.photoUrls.length === 0) return entry;
      const base64Urls = await Promise.all(entry.photoUrls.map((u) => imageToBase64(u)));
      return { ...entry, photoUrls: base64Urls };
    })
  );

/* ── Page backgrounds (CSS — prints reliably in WKWebView/WebView) ── */

const bgClass = (bg: PageBackground): string => {
  switch (bg) {
    case "lined":
      return "bg-lined";
    case "dotted":
      return "bg-dotted";
    default:
      return "";
  }
};

const BG_CSS = `
.bg-lined {
  background-color: #ffffff;
  background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 23px, rgba(147,197,253,0.35) 23px, rgba(147,197,253,0.35) 24px);
}
.bg-dotted {
  background-color: #ffffff;
  background-image: radial-gradient(rgba(120,120,120,0.22) 1.1px, transparent 1.1px);
  background-size: 16px 16px;
}`;

/* ── Cover decorations ── */

const coverDecorations = (cover: CoverTemplate, S: BookScale): string => {
  const px = S.px;
  if (cover === "nebula") {
    return `
      <div style="position:absolute;top:0;right:0;width:${px(300)}px;height:${px(300)}px;background:rgba(255,255,255,0.08);border-radius:50%;filter:blur(${px(20)}px);"></div>
      <div style="position:absolute;bottom:0;left:0;width:${px(400)}px;height:${px(400)}px;background:rgba(236,72,153,0.15);border-radius:50%;filter:blur(${px(20)}px);"></div>`;
  }
  if (cover === "midnight") {
    return MIDNIGHT_STARS.map(
      (s) =>
        `<div style="position:absolute;top:${s.top};left:${s.left};width:${px(s.size * 4)}px;height:${px(s.size * 4)}px;background:rgba(255,255,255,0.45);border-radius:50%;"></div>`
    ).join("");
  }
  if (cover === "botanical") {
    return `
      <div style="position:absolute;top:${px(40)}px;left:${px(40)}px;font-size:${px(80)}px;color:rgba(22,163,74,0.15);">❀</div>
      <div style="position:absolute;bottom:${px(40)}px;right:${px(40)}px;font-size:${px(60)}px;color:rgba(22,163,74,0.15);transform:rotate(45deg);">✿</div>
      <div style="position:absolute;top:25%;right:${px(50)}px;font-size:${px(50)}px;color:rgba(22,163,74,0.08);">🌿</div>`;
  }
  return "";
};

/* ── Cover page ── */

const buildCoverHTML = (config: BookConfig, S: BookScale, fontCSS: string, fontImportUrl: string): string => {
  const px = S.px;
  const color = COVER_TEXT_COLORS[config.cover];
  const gradient = COVER_GRADIENTS[config.cover];
  const light = isLightCover(config.cover);
  const cfs = getCoverFontSizes(config.fontSize || "medium");

  const avatarHTML =
    config.showAvatar && config.avatarUrl
      ? `<img src="${config.avatarUrl}" style="width:${px(cfs.avatar)}px;height:${px(cfs.avatar)}px;border-radius:50%;object-fit:cover;border:${px(6)}px solid ${light ? "#d6d3d1" : "rgba(255,255,255,0.35)"};margin-bottom:${px(48)}px;" />`
      : "";

  const titleItalic = config.cover === "minimalist" ? "font-style:italic;" : "";

  return `
  <div class="page cover" style="background:${gradient};color:${color};">
    ${coverDecorations(config.cover, S)}
    <div style="position:relative;z-index:2;text-align:center;max-width:80%;">
      ${avatarHTML}
      <div style="font-size:${px(cfs.subtitle)}px;letter-spacing:0.18em;opacity:0.85;margin-bottom:${px(36)}px;font-weight:500;">The Soul Journal of</div>
      <div style="font-size:${px(cfs.title)}px;font-weight:700;line-height:1.05;${titleItalic}margin-bottom:${px(40)}px;">${escMultiline(smartTitleCase(config.userName))}</div>
      <div style="font-size:${px(cfs.year)}px;letter-spacing:0.18em;opacity:0.7;margin-top:${px(24)}px;">${escMultiline(config.yearRange)}</div>
    </div>
  </div>`;
};

/* ── Photo gallery (web buildImageGalleryHTML) ── */

const buildImageGalleryHTML = (photoUrls: string[], photoSize: PhotoSize, isRTL: boolean, S: BookScale): string => {
  if (!photoUrls || photoUrls.length === 0) return "";
  const px = S.px;
  const count = Math.min(photoUrls.length, 5);
  const urls = photoUrls.slice(0, 5);
  const dims = getPhotoDimensions(photoSize);
  const dir = isRTL ? "rtl" : "ltr";

  let gridStyle = "";
  let imgStyle = `border-radius:${px(15)}px;border:1px solid #d1d5db;object-fit:contain;`;

  if (count <= 2) {
    const imgW = count === 1 ? Math.min(px(dims.w * 2.2), 320) : px(dims.w * 1.4);
    const imgH = count === 1 ? px(dims.h * 2) : px(dims.h * 1.4);
    gridStyle = `display:flex;justify-content:center;align-items:flex-start;gap:${px(12)}px;direction:${dir};`;
    imgStyle += `max-width:${imgW}px;max-height:${imgH}px;width:auto;height:auto;`;
  } else {
    gridStyle = `display:grid;grid-template-columns:1fr 1fr;gap:${px(10)}px;justify-items:center;direction:${dir};`;
    imgStyle += `width:100%;height:auto;max-height:${px(dims.h * 1.2 * 3)}px;`;
  }

  return `
  <div style="margin:${px(40)}px auto;max-width:${S.fixed ? 320 : "88%"};text-align:center;">
    <div style="${gridStyle}">
      ${urls.map((u) => `<img src="${u}" style="${imgStyle}" />`).join("")}
    </div>
  </div>`;
};

/* ── Soul reflection box ── */

const buildSoulReflectionHTML = (reflection: string, fs: number, px: (n: number) => number): string => {
  if (!reflection) return "";
  return `
  <div style="margin-top:${px(28)}px;padding:${px(16)}px ${px(20)}px;border-radius:${px(14)}px;background:linear-gradient(135deg, rgba(139,92,246,0.08), rgba(236,72,153,0.06));border:1px solid rgba(139,92,246,0.15);">
    <div style="display:flex;align-items:center;gap:${px(8)}px;margin-bottom:${px(8)}px;">
      <span style="font-size:${px(14)}px;">✨</span>
      <span style="font-size:${px(fs - 4)}px;font-weight:600;color:#7c3aed;letter-spacing:0.04em;">Message from Your Soul</span>
    </div>
    <p style="font-size:${px(fs - 1)}px;line-height:1.7;color:#4b5563;font-style:italic;">"${escMultiline(reflection)}"</p>
  </div>`;
};

const watermarkHTML = (px: (n: number) => number) =>
  `<div style="position:absolute;bottom:${px(30)}px;right:${px(36)}px;font-size:${px(24)}px;opacity:0.06;font-family:Georgia,serif;z-index:2;">✦</div>`;

/* ── Standard single-entry page ── */

const buildEntryPageHTML = (entry: JournalEntry, config: BookConfig, S: BookScale, fontCSS: string): string => {
  const px = S.px;
  const fs = getFontSizePx(config.fontSize || "medium");
  const date = formatEntryDate(entry.created_at);
  const mood = entry.mood ? entry.mood.charAt(0).toUpperCase() + entry.mood.slice(1) : "";
  const content = entry.enhanced_text || entry.original_transcription || "No content";
  const rtl = isRTLText(content);
  const dirAttr = rtl ? "direction:rtl;text-align:right;" : "";
  const moodBadge = mood
    ? `<span style="display:inline-block;background:#f5f5f5;padding:${px(2)}px ${px(10)}px;border-radius:${px(10)}px;font-size:${px(fs.meta - 1)}px;margin-left:${px(10)}px;font-style:normal;">${escMultiline(mood)}</span>`
    : "";

  return `
  <div class="page entry-page ${bgClass(config.background)}" style="${dirAttr}">
    ${config.watermark ? watermarkHTML(px) : ""}
    <div style="position:relative;z-index:1;">
      <div style="font-size:${px(fs.title)}px;font-weight:600;color:#0a0a0a;margin-bottom:${px(8)}px;">${escMultiline(smartTitleCase(entry.title || "Untitled Entry"))}</div>
      <div style="font-size:${px(fs.meta)}px;color:#9ca3af;margin-bottom:${px(20)}px;font-style:italic;">${escMultiline(date)}${moodBadge}</div>
      ${buildImageGalleryHTML(entry.photoUrls || [], config.photoSize || "medium", rtl, S)}
      <div style="font-size:${px(fs.body)}px;line-height:2;color:#374151;">${escMultiline(content)}</div>
      ${buildSoulReflectionHTML(entry.soul_reflection || "", fs.body, px)}
    </div>
  </div>`;
};

/* ── Magazine layout: drop cap + two columns ── */

const buildMagazineEntryHTML = (entry: JournalEntry, config: BookConfig, S: BookScale, fontCSS: string): string => {
  const px = S.px;
  const fs = getFontSizePx(config.fontSize || "medium");
  const date = formatEntryDate(entry.created_at);
  const mood = entry.mood ? entry.mood.charAt(0).toUpperCase() + entry.mood.slice(1) : "";
  const content = entry.enhanced_text || entry.original_transcription || "No content";
  const rtl = isRTLText(content);
  const dirAttr = rtl ? "direction:rtl;text-align:right;" : "";
  const first = escMultiline(content.charAt(0));
  const rest = escMultiline(content.slice(1));

  return `
  <div class="page entry-page ${bgClass(config.background)}" style="${dirAttr}">
    ${config.watermark ? watermarkHTML(px) : ""}
    <div style="position:relative;z-index:1;">
      <div style="font-size:${px(fs.meta)}px;color:#9ca3af;letter-spacing:0.06em;margin-bottom:${px(6)}px;">${escMultiline(date)}${mood ? ` · ${escMultiline(mood)}` : ""}</div>
      <div style="font-size:${px(fs.title + 6)}px;font-weight:700;color:#0a0a0a;line-height:1.1;margin-bottom:${px(8)}px;font-style:italic;">${escMultiline(smartTitleCase(entry.title || "Untitled Entry"))}</div>
      <div style="width:${px(48)}px;height:${px(2)}px;background:#0a0a0a;margin:${px(14)}px 0 ${px(22)}px;"></div>
      <div style="font-size:${px(fs.body)}px;line-height:1.85;color:#374151;column-count:2;column-gap:${px(24)}px;">
        <span style="float:left;font-size:${px(fs.body * 3.4)}px;line-height:0.85;font-weight:700;padding:${px(6)}px ${px(8)}px 0 0;color:#0a0a0a;">${first}</span>${rest}
      </div>
      ${buildImageGalleryHTML(entry.photoUrls || [], config.photoSize || "medium", rtl, S)}
      ${buildSoulReflectionHTML(entry.soul_reflection || "", fs.body, px)}
    </div>
  </div>`;
};

/* ── Photo-forward layout: hero photo top, text below ── */

const buildPhotoForwardEntryHTML = (entry: JournalEntry, config: BookConfig, S: BookScale, fontCSS: string): string => {
  const px = S.px;
  const fs = getFontSizePx(config.fontSize || "medium");
  const date = formatEntryDate(entry.created_at);
  const mood = entry.mood ? entry.mood.charAt(0).toUpperCase() + entry.mood.slice(1) : "";
  const content = entry.enhanced_text || entry.original_transcription || "No content";
  const rtl = isRTLText(content);
  const dirAttr = rtl ? "direction:rtl;text-align:right;" : "";

  const heroH = S.fixed ? px(595 * 0.42) : "42vh";
  const hero = entry.photoUrls && entry.photoUrls.length > 0
    ? `<div style="width:100%;height:${heroH};margin-bottom:${px(28)}px;overflow:hidden;"><img src="${entry.photoUrls[0]}" style="width:100%;height:100%;object-fit:cover;" /></div>`
    : `<div style="width:100%;height:${S.fixed ? px(595 * 0.18) : "18vh"};margin-bottom:${px(28)}px;background:linear-gradient(135deg,#fef3c7,#fde68a);"></div>`;

  const extraPhotos = entry.photoUrls && entry.photoUrls.length > 1
    ? buildImageGalleryHTML(entry.photoUrls.slice(1), config.photoSize || "small", rtl, S)
    : "";

  return `
  <div class="page entry-page ${bgClass(config.background)}" style="padding:0;${dirAttr}">
    ${config.watermark ? watermarkHTML(px) : ""}
    <div style="position:relative;z-index:1;">
      ${hero}
      <div style="padding:0 ${px(56)}px ${px(60)}px;">
        <div style="font-size:${px(fs.meta)}px;color:#9ca3af;letter-spacing:0.06em;margin-bottom:${px(8)}px;">${escMultiline(date)}${mood ? ` · ${escMultiline(mood)}` : ""}</div>
        <div style="font-size:${px(fs.title + 4)}px;font-weight:600;color:#0a0a0a;margin-bottom:${px(18)}px;">${escMultiline(smartTitleCase(entry.title || "Untitled Entry"))}</div>
        <div style="font-size:${px(fs.body)}px;line-height:1.95;color:#374151;">${escMultiline(content)}</div>
        ${extraPhotos}
        ${buildSoulReflectionHTML(entry.soul_reflection || "", fs.body, px)}
      </div>
    </div>
  </div>`;
};

/* ── Continuous layout: up to 3 flowing entries per page, dividers between ── */

const buildContinuousEntriesHTML = (entries: JournalEntry[], config: BookConfig, S: BookScale, fontCSS: string): string => {
  const px = S.px;
  const fs = getFontSizePx(config.fontSize || "medium");

  return entries
    .map((entry, idx) => {
      const date = formatEntryDate(entry.created_at);
      const mood = entry.mood ? entry.mood.charAt(0).toUpperCase() + entry.mood.slice(1) : "";
      const content = entry.enhanced_text || entry.original_transcription || "No content";
      const rtl = isRTLText(content);
      const dirAttr = rtl ? "direction:rtl;text-align:right;" : "";
      const moodBadge = mood
        ? `<span style="display:inline-block;background:#f5f5f5;padding:${px(2)}px ${px(10)}px;border-radius:${px(10)}px;font-size:${px(fs.meta - 1)}px;margin-left:${px(10)}px;font-style:normal;">${escMultiline(mood)}</span>`
        : "";
      const divider = idx < entries.length - 1 ? `<div style="height:1px;background:#e5e7eb;margin:${px(40)}px 0;"></div>` : "";
      return `
      <div class="entry-flow" style="${dirAttr}">
        <div style="font-size:${px(fs.title)}px;font-weight:600;color:#0a0a0a;margin-bottom:${px(8)}px;">${escMultiline(smartTitleCase(entry.title || "Untitled Entry"))}</div>
        <div style="font-size:${px(fs.meta)}px;color:#9ca3af;margin-bottom:${px(20)}px;font-style:italic;">${escMultiline(date)}${moodBadge}</div>
        ${buildImageGalleryHTML(entry.photoUrls || [], config.photoSize || "medium", rtl, S)}
        <div style="font-size:${px(fs.body)}px;line-height:2;color:#374151;">${escMultiline(content)}</div>
        ${buildSoulReflectionHTML(entry.soul_reflection || "", fs.body, px)}
        ${divider}
      </div>`;
    })
    .join("");
};

/* ── Back cover ── */

const buildBackCoverHTML = (S: BookScale, fontCSS: string, fontImportUrl: string): string => `
  <div class="page back-cover">
    <div style="font-size:${S.px(18)}px;font-style:italic;color:#78716c;text-align:center;max-width:${S.fixed ? 320 : "80%"};margin-bottom:${S.px(24)}px;line-height:1.6;">
      "Every page is a piece of your soul."
    </div>
    <div style="width:${S.px(50)}px;height:1px;background:#d6d3d1;margin-bottom:${S.px(16)}px;"></div>
    <div style="font-size:${S.px(10)}px;color:#a8a29e;letter-spacing:0.12em;">Soul Journal · ${new Date().getFullYear()}</div>
  </div>`;

/* ── Date formatting (locale-aware, like the mobile app's other screens) ── */

const formatEntryDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  } catch {
    return new Date(iso).toDateString();
  }
};

/* ── Layout dispatch ── */

const buildEntryByLayout = (entry: JournalEntry, config: BookConfig, S: BookScale, fontCSS: string): string => {
  if (config.layout === "magazine") return buildMagazineEntryHTML(entry, config, S, fontCSS);
  if (config.layout === "photo-forward") return buildPhotoForwardEntryHTML(entry, config, S, fontCSS);
  return buildEntryPageHTML(entry, config, S, fontCSS);
};

/* ── Shared document shell ── */

const buildDocShell = (bodyInner: string, fontCSS: string, fontImportUrl: string, S: BookScale, extraCss = ""): string => {
  const pageCss = S.fixed
    ? `.page { width:${S.pageW}px; height:${S.pageH}px; overflow:hidden; position:relative; page-break-after: always; }`
    : `.page { width:${S.pageW}; min-height:${S.pageH}; position:relative; page-break-after: always; }`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=${S.fixed ? S.pageW : 420}">
<link href="${fontImportUrl}" rel="stylesheet">
<style>
  @page { size: A5 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ${fontCSS}; color: #1a1a1a; word-spacing: 0.15em; letter-spacing: 0.01em; }
  ${pageCss}
  .cover { display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
  .entry-page { background-color: #ffffff; padding: ${S.px(60)}px ${S.px(48)}px; }
  .entry-flow { page-break-inside: avoid; }
  .back-cover { background: #f5f5f4; display: flex; flex-direction: column; align-items: center; justify-content: center; page-break-after: auto; }
  .page:last-child { page-break-after: auto; }
  ${BG_CSS}
  ${extraCss}
</style></head><body>${bodyInner}</body></html>`;
};

/* ── Public: full book HTML for expo-print ── */

export const buildBookHTML = (config: BookConfig, entries: JournalEntry[]): string => {
  const fontImportUrl = fontImportUrlFor(config.font);
  const fontCSS = fontCSSFor(config.font);
  const S = PDF_SCALE;

  const cover = buildCoverHTML(config, S, fontCSS, fontImportUrl);
  const back = buildBackCoverHTML(S, fontCSS, fontImportUrl);

  let bodyInner: string;
  if (config.layout === "one-per-page" || config.layout === "magazine" || config.layout === "photo-forward") {
    bodyInner = cover + entries.map((e) => buildEntryByLayout(e, config, S, fontCSS)).join("") + back;
  } else {
    bodyInner = cover + `<div class="page entry-page ${bgClass(config.background)}">${buildContinuousEntriesHTML(entries, config, S, fontCSS)}</div>` + back;
  }

  return buildDocShell(bodyInner, fontCSS, fontImportUrl, S);
};

/* ── Public: single A5 page for the in-app WebView preview ── */

export const buildPreviewPageHTML = (config: BookConfig, entry: JournalEntry): string => {
  const fontImportUrl = fontImportUrlFor(config.font);
  const fontCSS = fontCSSFor(config.font);
  const S = PREVIEW_SCALE;
  const bodyInner = buildEntryByLayout({ ...entry }, config, S, fontCSS);
  return buildDocShell(bodyInner, fontCSS, fontImportUrl, S);
};

/* ── Font helpers (single source of truth: BOOK_FONTS in bookTypes.ts) ── */

export const fontCSSFor = (font: BookConfig["font"]): string => getBookFontConfig(font).css;

export const fontImportUrlFor = (font: BookConfig["font"]): string => getBookFontConfig(font).importUrl;
