/**
 * Google Sign-In for native (Supabase PKCE flow via expo-auth-session).
 * Uses Supabase's own authorize/token endpoints — no separate Google client
 * ID needed; the Supabase project's configured Google provider handles it.
 * NOTE: requires on-device testing (the OAuth loop can't complete in a CLI).
 */
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: `${SUPABASE_URL}/auth/v1/authorize`,
  tokenEndpoint: `${SUPABASE_URL}/auth/v1/token`,
  revocationEndpoint: `${SUPABASE_URL}/auth/v1/logout`,
};

let requestPromise: Promise<AuthSession.AuthRequest> | null = null;

const getRequest = () => {
  if (!requestPromise) {
    requestPromise = AuthSession.loadAsync(
      {
        clientId: ANON_KEY,
        redirectUri: AuthSession.makeRedirectUri(),
        scopes: ["openid", "profile", "email"],
        usePKCE: true,
        extraParams: {
          provider: "google",
        },
      },
      discovery
    );
  }
  return requestPromise;
};

/** Returns an error message string, or null on success. */
export const signInWithGoogle = async (): Promise<string | null> => {
  try {
    const request = await getRequest();
    const result = await request.promptAsync(discovery);

    if (result.type !== "success") {
      return result.type === "cancel" ? null : "Google sign-in was interrupted.";
    }

    const { access_token, refresh_token } = result.params;
    if (!access_token || !refresh_token) {
      return "Google sign-in did not return a session.";
    }

    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    return error?.message ?? null;
  } catch (e) {
    console.warn("google sign-in error", e);
    return "Google sign-in failed. Please try again.";
  }
};
