import { supabase } from "@/lib/supabase";

/**
 * voice_profiles sync via the `voice-profiles-sync` edge function.
 *
 * The voice_profiles table has NO RLS policies ("permission denied for table
 * voice_profiles"), so direct writes fail for authenticated users. The edge
 * function verifies the caller's JWT then performs the operation with the
 * service role, scoped to their own user_id.
 */

export interface VoiceProfileRow {
  lang: string;
  voice_id: string;
  updated_at?: string;
}

/** List this user's clones from the backend. */
export async function fetchVoiceProfiles(): Promise<VoiceProfileRow[]> {
  const { data, error } = await supabase.functions.invoke("voice-profiles-sync", {
    method: "GET",
  });
  if (error) throw error;
  return data?.profiles ?? [];
}

/** Upsert one clone (user_id + lang is the primary key). */
export async function saveVoiceProfile(lang: string, voiceId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("voice-profiles-sync", {
    method: "POST",
    body: { lang, voice_id: voiceId },
  });
  if (error) throw error;
  if (!data?.profile) throw new Error("no profile returned");
}

/** Delete one clone for this user. */
export async function removeVoiceProfile(lang: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("voice-profiles-sync", {
    method: "DELETE",
    body: { lang },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error("delete failed");
}
