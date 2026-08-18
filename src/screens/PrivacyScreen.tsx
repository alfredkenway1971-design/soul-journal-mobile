import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useMemo } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { colors, radius, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { useT } from "@/store/settingsStore";

export default function PrivacyScreen() {
  const navigation = useNavigation();
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const t = useT();
  const isFrench = t("profile.about") === "À propos";

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>🔒 {t("privacy.title")}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.card, shadows.card]}>
          {isFrench ? (
            <>
              <Text style={styles.h1}>Politique de confidentialité — Soul Journal</Text>
              <Text style={styles.updated}>Dernière mise à jour : 17 août 2026</Text>

              <Text style={styles.h2}>1. Données que vous fournissez</Text>
              <Text style={styles.p}>• <Text style={styles.b}>Compte</Text> : adresse e-mail et mot de passe (ou connexion Google).</Text>
              <Text style={styles.p}>• <Text style={styles.b}>Entrées de journal</Text> : texte, transcriptions vocales et humeurs. Vos entrées sont privées — visibles seulement par vous.</Text>
              <Text style={styles.p}>• <Text style={styles.b}>Échantillon vocal (Premium)</Text> : utilisé uniquement pour créer votre « voix clonée » qui lit vos entrées.</Text>

              <Text style={styles.h2}>2. Données traitées par l'IA</Text>
              <Text style={styles.p}>Vos entrées sont envoyées aux services d'IA (DeepSeek, Whisper hébergé) uniquement pour traiter votre demande. Elles ne servent pas à entraîner des modèles et ne sont jamais vendues.</Text>

              <Text style={styles.h2}>3. Données automatiques</Text>
              <Text style={styles.p}>• Diagnostic : journaux d'erreurs anonymisés.</Text>
              <Text style={styles.p}>• Paiements : traités par Google Play Billing — nous ne voyons jamais vos données de carte.</Text>

              <Text style={styles.h2}>4. Stockage</Text>
              <Text style={styles.p}>Vos données sont stockées sur Supabase (hébergement sécurisé, chiffré en transit). Vous pouvez supprimer vos entrées à tout moment.</Text>

              <Text style={styles.h2}>5. Vos droits</Text>
              <Text style={styles.p}>Exporter, modifier ou supprimer vos entrées, supprimer votre compte, ou demander la suppression de toutes vos données : amer.niyonzima@gmail.com</Text>

              <Text style={styles.h2}>6. Contact</Text>
              <Text style={styles.p}>amer.niyonzima@gmail.com</Text>
            </>
          ) : (
            <>
              <Text style={styles.h1}>Privacy Policy — Soul Journal</Text>
              <Text style={styles.updated}>Last updated: August 17, 2026</Text>

              <Text style={styles.h2}>1. Data you provide</Text>
              <Text style={styles.p}>• <Text style={styles.b}>Account</Text>: email address and password (or Google sign-in).</Text>
              <Text style={styles.p}>• <Text style={styles.b}>Journal entries</Text>: text, voice transcriptions, and moods. Your entries are private — visible only to you.</Text>
              <Text style={styles.p}>• <Text style={styles.b}>Voice sample (Premium)</Text>: used solely to create your "voice clone" that reads your entries aloud.</Text>

              <Text style={styles.h2}>2. Data processed by AI</Text>
              <Text style={styles.p}>Your entries are sent to AI services (DeepSeek, self-hosted Whisper) only to process your request. This data is not used to train models and is never sold.</Text>

              <Text style={styles.h2}>3. Automatically collected data</Text>
              <Text style={styles.p}>• Diagnostics: anonymized error logs to fix bugs.</Text>
              <Text style={styles.p}>• Payments: processed by Google Play Billing — we never see or store your card details.</Text>

              <Text style={styles.h2}>4. Storage</Text>
              <Text style={styles.p}>Your data is stored on Supabase (secure hosting, encrypted in transit). You can delete your entries at any time in the app.</Text>

              <Text style={styles.h2}>5. Your rights</Text>
              <Text style={styles.p}>Export, edit, or delete your entries, delete your account, or request deletion of all your data: amer.niyonzima@gmail.com</Text>

              <Text style={styles.h2}>6. Contact</Text>
              <Text style={styles.p}>amer.niyonzima@gmail.com</Text>
            </>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const makeStyles = (appFonts: AppFonts) => StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.cardGlassStrong,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  iconBtnText: { fontSize: 20, color: colors.primary, fontFamily: appFonts.bodyBold },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, color: colors.text, fontFamily: appFonts.displayBold },
  card: {
    ...glassCard,
    padding: 20,
  },
  h1: { fontSize: 17, color: colors.text, fontFamily: appFonts.displayBold, marginBottom: 4 },
  updated: { fontSize: 12, color: colors.textFaint, fontFamily: appFonts.body, marginBottom: 14 },
  h2: { fontSize: 14, color: colors.primary, fontFamily: appFonts.bodySemiBold, marginTop: 14, marginBottom: 6 },
  p: { fontSize: 13, lineHeight: 20, color: colors.text, fontFamily: appFonts.body, marginBottom: 4 },
  b: { fontWeight: "700" },
});
