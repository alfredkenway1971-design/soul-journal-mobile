import { supabase } from "@/lib/supabase";

/**
 * voice_profiles direct CRUD.
 *
 * The table is created + RLS-policied by the `ensure-voice-profiles` edge
 * function (policy: auth.uid() = user_id). Direct queries now work for the
 * authenticated user — same as the web app.
 */

export interface VoiceProfileRow {
  lang: string;
  voice_id: string;
  updated_at?: string;
}

/** List this user's clones (RLS: own rows only). */
export async function fetchVoiceProfiles(): Promise<VoiceProfileRow[]> {
  const { data, error } = await supabase
    .from("voice_profiles")
    .select("lang, voice_id, updated_at");
  if (error) throw error;
  return (data ?? []) as VoiceProfileRow[];
}

/** Upsert one clone (user_id + lang is the primary key). */
export async function saveVoiceProfile(lang: string, voiceId: string): Promise<void> {
  const { data, error } = await supabase
    .from("voice_profiles")
    .upsert(
      { lang, voice_id: voiceId, updated_at: new Date().toISOString() },
      { onConflict: "user_id,lang" }
    )
    .select("lang, voice_id")
    .single();
  if (error) throw error;
  if (!data) throw new Error("no profile returned");
}

/** Delete one clone for this user. */
export async function removeVoiceProfile(lang: string): Promise<void> {
  const { data, error } = await supabase
    .from("voice_profiles")
    .delete()
    .eq("lang", lang);
  if (error) throw error;
}
