/**
 * Google Sign-In for native (Supabase OAuth flow).
 *
 * Uses supabase.auth.signInWithOAuth with skipBrowserRedirect: true — the
 * officially supported Expo React Native pattern. The returned URL is opened
 * in an in-app browser session; Supabase's own callback (configured on the
 * Google provider) completes the flow and hands back the session.
 *
 * NOTE: do NOT pass a clientId to expo-auth-session's loadAsync for this flow —
 * doing so makes Supabase forward that value to Google as the OAuth client_id,
 * which Google rejects with "400. That's an error." (the anon key is a JWT,
 * not a Google OAuth client ID).
 *
 * Requires on-device testing (the OAuth loop can't complete in a CLI).
 */
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const redirectUri = AuthSession.makeRedirectUri();

/** Returns an error message string, or null on success. */
export const signInWithGoogle = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) return error.message;
    if (!data?.url) return "Google sign-in could not be started.";

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    if (result.type !== "success") {
      return result.type === "cancel" ? null : "Google sign-in was interrupted.";
    }

    // PKCE flow: Supabase's callback URL carries ?code=...
    const code = new URL(result.url).searchParams.get("code");
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      return exchangeError?.message ?? null;
    }

    // Implicit flow: tokens arrive in the URL fragment (#access_token=...)
    const params = new URLSearchParams(result.url.split("#")[1] || "");
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      const { error: setError } = await supabase.auth.setSession({ access_token, refresh_token });
      return setError?.message ?? null;
    }

    return "Google sign-in did not return a session.";
  } catch (e) {
    console.warn("google sign-in error", e);
    return "Google sign-in failed. Please try again.";
  }
};
