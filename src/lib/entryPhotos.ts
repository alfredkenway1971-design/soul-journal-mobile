/**
 * Entry photo helpers — web parity with /root/soul-journal (useJournalAPI.ts
 * uploadPhoto/saveEntryMedia + RecordPage photo UI).
 * Ported 2026-08-19.
 *
 * Storage model (shared with web): photos live in the "journal-photos" bucket
 * at <userId>/<timestamp>.<ext>; each photo is linked to an entry via the
 * entry_media table (media_type='photo'); the book builder resolves signed
 * URLs (1h expiry) and embeds them as base64 in the exported PDF.
 */
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/lib/supabase";

export interface PickedPhoto {
  uri: string;
  ext: string;
  mime: string;
}

export type PickResult =
  | { status: "ok"; photo: PickedPhoto }
  | { status: "denied" }
  | { status: "cancelled" };

/** The PDF gallery renders up to 5 photos per entry (web parity). */
export const MAX_ENTRY_PHOTOS = 5;

/** base64 string -> Uint8Array (for Supabase storage upload) */
function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Request permission ONLY on user action — iOS never re-asks once denied
 * (same lesson as the mic permission, fixed 1043b3f).
 */
export const ensurePhotoPermission = async (source: "camera" | "library"): Promise<boolean> => {
  const current =
    source === "camera"
      ? await ImagePicker.getCameraPermissionsAsync()
      : await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  return req.granted;
};

/** Open the camera or the photo library; returns the picked image (or why not). */
export const pickPhoto = async (source: "camera" | "library"): Promise<PickResult> => {
  const ok = await ensurePhotoPermission(source);
  if (!ok) return { status: "denied" };
  const options = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsEditing: false,
  };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]?.uri) return { status: "cancelled" };
  const uri = result.assets[0].uri;
  // iOS hands back HEIC photos from the camera roll; the picker converts to
  // JPEG when quality < 1, but normalize defensively so storage gets a jpg.
  const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ext === "heic" || ext === "heif" ? "jpg" : ext;
  const mime = safeExt === "png" ? "image/png" : "image/jpeg";
  return { status: "ok", photo: { uri, ext: safeExt, mime } };
};

/**
 * Upload one picked photo to the journal-photos bucket.
 * Returns the storage_path (web parity: <userId>/<timestamp>.<ext>).
 */
export const uploadEntryPhoto = async (photo: PickedPhoto, userId: string): Promise<string> => {
  const base64 = await FileSystem.readAsStringAsync(photo.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const storagePath = `${userId}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${photo.ext}`;
  const { data, error } = await supabase.storage
    .from("journal-photos")
    .upload(storagePath, decodeBase64(base64), { contentType: photo.mime });
  if (error) throw new Error(error.message);
  return data?.path || storagePath;
};

/** Link a photo to an entry (web parity: entry_media row). */
export const saveEntryMedia = async (entryId: string, storagePath: string): Promise<void> => {
  const { error } = await supabase
    .from("entry_media")
    .insert({ entry_id: entryId, media_type: "photo", storage_path: storagePath });
  if (error) throw new Error(error.message);
};

/** One entry photo: signed display URL + storage path (for removal). */
export interface EntryPhotoRef {
  url: string;
  storagePath: string;
}

/** Resolve an entry's photos to signed URLs (web parity: createSignedUrl 3600s). */
export const loadEntryPhotos = async (entryId: string): Promise<EntryPhotoRef[]> => {
  const { data: media, error } = await supabase
    .from("entry_media")
    .select("storage_path")
    .eq("entry_id", entryId)
    .eq("media_type", "photo");
  if (error) return [];
  const refs: EntryPhotoRef[] = [];
  for (const m of media ?? []) {
    const { data: signed } = await supabase.storage
      .from("journal-photos")
      .createSignedUrl(m.storage_path, 3600);
    if (signed?.signedUrl) refs.push({ url: signed.signedUrl, storagePath: m.storage_path });
  }
  return refs;
};

/** Convenience: just the signed URLs (used by screens that don't remove). */
export const loadEntryPhotoUrls = async (entryId: string): Promise<string[]> =>
  (await loadEntryPhotos(entryId)).map((r) => r.url);

/** Remove a photo from an entry (media row + storage object). */
export const deleteEntryPhoto = async (storagePath: string): Promise<void> => {
  try {
    await supabase
      .from("entry_media")
      .delete()
      .eq("storage_path", storagePath)
      .eq("media_type", "photo");
  } catch {}
  try {
    await supabase.storage.from("journal-photos").remove([storagePath]);
  } catch {}
};
