import { supabase } from "@/lib/supabase";

/**
 * voice_profiles direct CRUD (web parity).
 *
 * The table is created + RLS-policied by the `ensure-voice-profiles` edge
 * function: policy voice_profiles_own FOR ALL USING/WITH CHECK (auth.uid() =
 * user_id), plus base GRANTs for authenticated. CRITICAL: every insert/upsert
 * MUST include user_id = the signed-in user's id, or the WITH CHECK fails with
 * "new row violates row-level security policy for table 'voice_profiles'".
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

/** Upsert one clone — MUST carry user_id so the RLS WITH CHECK passes. */
export async function saveVoiceProfile(lang: string, voiceId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("no session");

  const { data, error } = await supabase
    .from("voice_profiles")
    .upsert(
      { user_id: user.id, lang, voice_id: voiceId, updated_at: new Date().toISOString() },
      { onConflict: "user_id,lang" }
    )
    .select("lang, voice_id")
    .single();
  if (error) throw error;
  if (!data) throw new Error("no profile returned");
}

/** Delete one clone for this user (RLS USING filters to own rows). */
export async function removeVoiceProfile(lang: string): Promise<void> {
  const { data, error } = await supabase
    .from("voice_profiles")
    .delete()
    .eq("lang", lang);
  if (error) throw error;
}
