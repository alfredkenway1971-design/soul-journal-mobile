import { supabase } from "@/lib/supabase";

/**
 * Resolve a profile avatar URL that actually works.
 *
 * Known quirk of this project's Supabase storage: the `avatars` bucket is
 * double-nested (`avatars/avatars/<user>/<file>`), but the stored
 * `profiles.avatar_url` and `getPublicUrl()` both produce the single-nested
 * path (`avatars/<user>/<file>`) which the storage server rejects (400).
 * This resolver tries the stored URL, then the corrected double-nested path,
 * then falls back to discovering the file in the bucket. Returns null when
 * no readable avatar exists (callers show initials).
 */
export async function resolveAvatarUrl(storedUrl: string | null | undefined): Promise<string | null> {
  if (!storedUrl) return null;

  // 1) Try the stored URL as-is (works when the structure was once flat).
  if (await urlWorks(storedUrl)) return storedUrl;

  // 2) Rewrite single-nested -> double-nested (avatars/avatars/<user>/<file>).
  const corrected = correctAvatarPath(storedUrl);
  if (corrected && corrected !== storedUrl && (await urlWorks(corrected))) return corrected;

  // 3) Discover the file in the bucket (user folders hold the actual image).
  const discovered = await discoverAvatar();
  if (discovered) return discovered;

  return null;
}

/** HEAD-request a URL; true when it returns 2xx. */
async function urlWorks(u: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(u, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/** Fix a known-bad avatar URL: insert the missing second "avatars" segment. */
export function correctAvatarPath(storedUrl: string): string | null {
  try {
    const u = new URL(storedUrl);
    const path = u.pathname; // /storage/v1/object/public/avatars/<user>/<file>
    const m = path.match(/\/avatars\/([^/]+)\/([^/]+)$/);
    if (!m) return null;
    // Already double-nested -> as-is; single-nested -> fix it.
    if (path.includes("/avatars/avatars/")) return storedUrl.split("?")[0];
    u.pathname = `/storage/v1/object/public/avatars/avatars/${m[1]}/${m[2]}`;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * List the avatars bucket and return the first image under this user's folder
 * as a working public URL (handles both flat and nested layouts).
 */
async function discoverAvatar(): Promise<string | null> {
  try {
    // Possible folder names: "<userId>" directly, or "avatars/<userId>".
    const roots = ["", "avatars/"];
    for (const root of roots) {
      const { data: folders, error } = await supabase.storage.from("avatars").list(root);
      if (error || !folders?.length) continue;
      // Find this user's folder by uuid prefix (longest match).
      const { data: user } = await supabase.auth.getUser();
      const uid = user?.user?.id;
      if (!uid) continue;
      const folder = folders.find((f) => uid.startsWith(f.name));
      if (!folder) continue;
      const { data: files, error: ferr } = await supabase.storage
        .from("avatars")
        .list(root + folder.name);
      if (ferr || !files?.length) continue;
      const img = files.find((f) => /\.(jpg|jpeg|png|webp)$/i.test(f.name));
      if (!img) continue;
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(root + folder.name + "/" + img.name);
      if (await urlWorks(publicUrl)) return publicUrl;
    }
  } catch {
    /* silent */
  }
  return null;
}

/** Tiny hook-friendly helper for screens that keep a single avatar state. */
export async function loadAvatar(storedUrl: string | null | undefined, setter: (u: string | null) => void) {
  const resolved = await resolveAvatarUrl(storedUrl);
  setter(resolved);
}
