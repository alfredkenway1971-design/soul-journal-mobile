/**
 * Soul Book Builder — full 4-step wizard (web parity with the web app's
 * BookBuilderPage). Steps: Date Range → Cover & Title → Font & Layout →
 * Preview & Generate. Generates a styled A5 PDF via expo-print (photos,
 * fonts, page backgrounds, layouts, watermark) and renders an in-app
 * entry-page preview in a WebView. Ported 2026-08-19.
 */
import { useCallback, useEffect, useState, useMemo } from "react";
import {
  View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator,
  Share, Switch, TextInput, Modal, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import DateTimePicker from "@react-native-community/datetimepicker";
import { WebView } from "react-native-webview";
import { useNavigation } from "@react-navigation/native";
import { useWindowDimensions } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { colors, radius, glassCard, shadows } from "@/theme";
import { useAppFonts, type AppFonts } from "@/hooks/useAppFonts";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { useSubscriptionStore } from "@/store/subscriptionStore";
import { useT, useSettingsStore, localeFor } from "@/store/settingsStore";
import UpgradePrompt from "@/components/UpgradePrompt";
import CoverPreviewCard from "@/components/book-builder/CoverPreviewCard";
import FontSelector from "@/components/book-builder/FontSelector";
import PageStyleSelector from "@/components/book-builder/PageStyleSelector";
import {
  type BookConfig, type CoverTemplate, type BookFont, type FontSize,
  type PageBackground, type EntryLayout, type PhotoSize, type JournalEntry,
  COVER_TEMPLATES, getBookFontConfig,
} from "@/lib/bookTypes";
import { buildBookHTML, buildPreviewPageHTML, preloadEntryImages } from "@/lib/buildBookHTML";

const MOOD_EMOJI: Record<string, string> = { happy: "😊", good: "😇", fine: "😌", sad: "😔", unhappy: "😢" };

const STEPS: { icon: string; titleKey: string; descKey: string; desc2Key: string }[] = [
  { icon: "📅", titleKey: "bookBuilder.step1", descKey: "bookBuilder.selectRange", desc2Key: "bookBuilder.chooseEntries" },
  { icon: "🎨", titleKey: "bookBuilder.step2", descKey: "bookBuilder.coverDesign", desc2Key: "bookBuilder.coverDesc" },
  { icon: "✍️", titleKey: "bookBuilder.step3", descKey: "bookBuilder.voiceOfBook", desc2Key: "bookBuilder.typographyDesc" },
  { icon: "📖", titleKey: "bookBuilder.step4", descKey: "bookBuilder.yourBook", desc2Key: "bookBuilder.previewBefore" },
];

const FONT_SIZE_OPTS: { id: FontSize; key: string }[] = [
  { id: "small", key: "bookBuilder.fontSizeSmall" },
  { id: "medium", key: "bookBuilder.fontSizeMedium" },
  { id: "large", key: "bookBuilder.fontSizeLarge" },
];

const PHOTO_SIZE_OPTS: { id: PhotoSize; key: string; emoji: string }[] = [
  { id: "small", key: "bookBuilder.photoSmall", emoji: "🖼️" },
  { id: "medium", key: "bookBuilder.photoMedium", emoji: "🖼️" },
  { id: "large", key: "bookBuilder.photoLarge", emoji: "🖼️" },
];

export default function BookBuilderScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width: windowW } = useWindowDimensions();
  const gridCardW = (windowW - 40 - 20) / 3; // content padding 20×2, grid gap 10×2
  const t = useT();
  const language = useSettingsStore((s) => s.language);
  const appFonts = useAppFonts();
  const styles = useMemo(() => makeStyles(appFonts), [appFonts]);
  const user = useAuthStore((s) => s.user);
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const isRTL = language === "ar";

  /* Wizard state */
  const [step, setStep] = useState(1);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [countError, setCountError] = useState(false);

  /* Cover & title */
  const [cover, setCover] = useState<CoverTemplate>("nebula");
  const [customTitle, setCustomTitle] = useState("");
  const [showAvatar, setShowAvatar] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  /* Font & layout */
  const [font, setFont] = useState<BookFont>("classic");
  const [fontSize, setFontSize] = useState<FontSize>("medium");
  const [background, setBackground] = useState<PageBackground>("blank");
  const [layout, setLayout] = useState<EntryLayout>("one-per-page");
  const [watermark, setWatermark] = useState(true);
  const [photoSize, setPhotoSize] = useState<PhotoSize>("medium");

  /* Generate / preview */
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHTML, setPreviewHTML] = useState("");
  const [pickerField, setPickerField] = useState<"from" | "to" | null>(null);

  /* ── Load profile + avatar at mount ── */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      const name = profile?.display_name || user.email?.split("@")[0] || "";
      setDisplayName(name);
      if (profile?.avatar_url) {
        try {
          const { resolveAvatarUrl } = await import("@/lib/avatar");
          const url = await resolveAvatarUrl(profile.avatar_url);
          setAvatarUrl(url);
        } catch { /* initials fallback */ }
      }
    })();
  }, [user]);

  /* ── Entry count for the selected range (informational, step 1) ── */
  useEffect(() => {
    if (!user || !startDate || !endDate) {
      setEntryCount(null);
      setCountError(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    setCountError(false);
    (async () => {
      try {
        const to = new Date(endDate);
        to.setHours(23, 59, 59, 999);
        const { count } = await supabase
          .from("journal_entries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", to.toISOString());
        if (!cancelled) setEntryCount(count ?? 0);
      } catch {
        if (!cancelled) setCountError(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, startDate, endDate]);

  /* ── Helpers ── */
  const fmtDate = useCallback((d: Date | null) => {
    if (!d) return "";
    return d.toLocaleDateString(localeFor(language), { year: "numeric", month: "long", day: "numeric" });
  }, [language]);

  const setDateField = (field: "from" | "to", d: Date) => {
    if (field === "from") setStartDate(d);
    else setEndDate(d);
    setPickerField(null);
  };

  const canContinue = step !== 1 || (startDate !== null && endDate !== null);

  const fetchEntries = useCallback(async (asc: boolean) => {
    if (!user || !startDate || !endDate) return [];
    const to = new Date(endDate);
    to.setHours(23, 59, 59, 999);
    const { data } = await supabase
      .from("journal_entries")
      .select("id, title, mood, created_at, enhanced_text, original_transcription, soul_reflection")
      .eq("user_id", user.id)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: asc });
    return (data ?? []) as JournalEntry[];
  }, [user, startDate, endDate]);

  const fetchPhotosFor = useCallback(async (entryIds: string[]): Promise<Map<string, string[]>> => {
    const map = new Map<string, string[]>();
    if (!entryIds.length) return map;
    try {
      const { data: media } = await supabase
        .from("entry_media")
        .select("entry_id, storage_path")
        .in("entry_id", entryIds)
        .eq("media_type", "photo");
      for (const m of media ?? []) {
        const { data: signed } = await supabase.storage
          .from("journal-photos")
          .createSignedUrl(m.storage_path, 3600);
        if (signed?.signedUrl) {
          const arr = map.get(m.entry_id) ?? [];
          arr.push(signed.signedUrl);
          map.set(m.entry_id, arr);
        }
      }
    } catch { /* book still works without photos */ }
    return map;
  }, []);

  const buildConfig = useCallback((): BookConfig => {
    const years = startDate && endDate
      ? `${startDate.getFullYear()} — ${endDate.getFullYear()}`
      : `${new Date().getFullYear()}`;
    return {
      cover,
      font,
      background,
      layout,
      watermark,
      userName: customTitle.trim() || displayName || "My Soul Journal",
      yearRange: years,
      avatarUrl,
      showAvatar,
      photoSize,
      fontSize,
    };
  }, [cover, font, background, layout, watermark, customTitle, displayName, avatarUrl, showAvatar, photoSize, fontSize, startDate, endDate]);

  /* ── Generate the full PDF book ── */
  const generateBook = async () => {
    if (!user) {
      Alert.alert(t("bookBuilder.sessionExpired"), t("bookBuilder.sessionExpiredBody"));
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert(t("bookBuilder.selectRangeFirst"), t("bookBuilder.selectRangeFirstBody"));
      return;
    }
    setBuilding(true);
    try {
      setProgress(t("bookBuilder.fetchingEntries"));
      const entries = await fetchEntries(true);
      if (!entries.length) {
        Alert.alert(t("bookBuilder.noEntries"), t("bookBuilder.noEntriesBody"));
        setBuilding(false);
        return;
      }

      setProgress(t("bookBuilder.loadingPhotos"));
      const photoMap = await fetchPhotosFor(entries.map((e) => e.id));
      const withPhotos: JournalEntry[] = entries.map((e) => ({
        ...e,
        photoUrls: photoMap.get(e.id) ?? [],
      }));
      const loaded = await preloadEntryImages(withPhotos);

      const config = buildConfig();
      setProgress(t("bookBuilder.renderingCover"));
      const html = buildBookHTML(config, loaded);

      setProgress(t("bookBuilder.savingPdf"));
      const { uri } = await Print.printToFileAsync({
        html,
        width: 420,
        height: 595,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      const out = `${FileSystem.cacheDirectory}soul-book-${Date.now()}.pdf`;
      await FileSystem.copyAsync({ from: uri, to: out });
      setBuilding(false);
      try {
        await Share.share({ url: out, message: t("bookBuilder.bookDownloaded") });
      } catch {
        Alert.alert(t("bookBuilder.bookDownloaded"), t("bookBuilder.bookDownloadedBody").replace("{n}", String(entries.length)));
      }
    } catch (e) {
      console.warn("soul book error", e);
      setBuilding(false);
      Alert.alert(t("bookBuilder.generationFailed"), t("bookBuilder.generationFailedBody"));
    }
  };

  /* ── Preview a single entry page (WebView modal) ── */
  const generatePreview = async () => {
    if (!user) {
      Alert.alert(t("bookBuilder.sessionExpired"), t("bookBuilder.sessionExpiredBody"));
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert(t("bookBuilder.selectRangeFirst"), t("bookBuilder.selectRangeFirstBody"));
      return;
    }
    setPreviewing(true);
    try {
      const to = new Date(endDate);
      to.setHours(23, 59, 59, 999);
      const { data: sample } = await supabase
        .from("journal_entries")
        .select("id, title, mood, created_at, enhanced_text, original_transcription, soul_reflection")
        .eq("user_id", user.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", to.toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      if (!sample || !sample.length) {
        Alert.alert(t("bookBuilder.noEntries"), t("bookBuilder.noEntriesBody"));
        setPreviewing(false);
        return;
      }
      const photoMap = await fetchPhotosFor([sample[0].id]);
      const entry: JournalEntry = {
        ...(sample[0] as JournalEntry),
        photoUrls: photoMap.get(sample[0].id) ?? [],
      };
      const loaded = await preloadEntryImages([entry]);
      const html = buildPreviewPageHTML(buildConfig(), loaded[0]);
      setPreviewHTML(html);
      setPreviewOpen(true);
    } catch (e) {
      console.warn("soul book preview error", e);
      Alert.alert(t("bookBuilder.previewFailed"), t("bookBuilder.previewFailedBody"));
    } finally {
      setPreviewing(false);
    }
  };

  /* ── Step navigation ── */
  const goBack = () => {
    if (step > 1) setStep(step - 1);
    else navigation.goBack();
  };
  const goNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const stepMeta = STEPS[step - 1];
  const yearRange = startDate && endDate
    ? `${startDate.getFullYear()} — ${endDate.getFullYear()}`
    : `${new Date().getFullYear()}`;

  /* Layout id → summary label key (web uses camelCase keys) */
  const LAYOUT_SUMMARY_KEY: Record<EntryLayout, string> = {
    "one-per-page": "pageStyle.onePerPage",
    continuous: "pageStyle.continuous",
    magazine: "pageStyle.magazine",
    "photo-forward": "pageStyle.photoForward",
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.root}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable style={styles.iconBtn} onPress={goBack}>
          <Text style={styles.iconBtnText}>{step > 1 ? "←" : "✕"}</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t("bookBuilder.title")}</Text>
          <Text style={styles.headerStep}>
            {t("bookBuilder.stepOf").replace("{n}", String(step))} — {t(stepMeta.titleKey)}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress segments */}
      <View style={styles.progressRow}>
        {[1, 2, 3, 4].map((s) => (
          <View key={s} style={[styles.progressSeg, s <= step && styles.progressSegActive]} />
        ))}
      </View>

      {!isPremium ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <UpgradePrompt
            title={t("book.premiumTitle")}
            description={t("book.premiumDesc")}
            onPress={() => navigation.navigate("Pricing")}
          />
        </ScrollView>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Step intro */}
            <View style={styles.stepIntro}>
              <Text style={styles.stepIcon}>{stepMeta.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{t(stepMeta.descKey)}</Text>
                <Text style={styles.stepDesc}>{t(stepMeta.desc2Key)}</Text>
              </View>
            </View>

            {step === 1 && (
              <>
                <Pressable style={[styles.dateCard, shadows.soft]} onPress={() => setPickerField("from")}>
                  <Text style={styles.dateLabel}>{t("bookBuilder.from")}</Text>
                  <Text style={[styles.dateValue, !startDate && styles.datePlaceholder]}>
                    {startDate ? fmtDate(startDate) : t("bookBuilder.selectRange")}
                  </Text>
                  <Text style={styles.dateCaret}>📅</Text>
                </Pressable>
                <Pressable style={[styles.dateCard, shadows.soft]} onPress={() => setPickerField("to")}>
                  <Text style={styles.dateLabel}>{t("bookBuilder.to")}</Text>
                  <Text style={[styles.dateValue, !endDate && styles.datePlaceholder]}>
                    {endDate ? fmtDate(endDate) : t("bookBuilder.selectRange")}
                  </Text>
                  <Text style={styles.dateCaret}>📅</Text>
                </Pressable>

                {(checking || entryCount !== null || countError) && (
                  <View style={styles.countRow}>
                    {checking ? (
                      <>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.countText}>{t("bookBuilder.checkingEntries")}</Text>
                      </>
                    ) : countError ? (
                      <Text style={styles.countText}>{t("bookBuilder.couldntVerify")}</Text>
                    ) : (
                      <Text style={[styles.countText, entryCount === 0 && { color: colors.textFaint }]}>
                        {entryCount === 0
                          ? t("bookBuilder.noEntriesRange")
                          : t("bookBuilder.entriesFound").replace("{n}", String(entryCount))}
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.sectionLabel}>{t("bookBuilder.customTitle")}</Text>
                <TextInput
                  style={[styles.titleInput, shadows.soft]}
                  value={customTitle}
                  onChangeText={setCustomTitle}
                  placeholder={displayName || "My Soul Journal"}
                  placeholderTextColor={colors.textFaint}
                  maxLength={60}
                />

                <Text style={styles.sectionLabel}>{t("bookBuilder.coverDesign")}</Text>
                <View style={styles.coverGrid}>
                  {COVER_TEMPLATES.map((c) => {
                    const active = cover === c.id;
                    return (
                      <Pressable key={c.id} style={styles.coverCell} onPress={() => setCover(c.id)}>
                        <View style={[styles.coverCellCard, active && styles.coverCellActive]}>
                          <CoverPreviewCard
                            cover={c.id}
                            userName={customTitle.trim() || displayName || "My Soul Journal"}
                            yearRange={yearRange}
                            avatarUrl={avatarUrl}
                            showAvatar={showAvatar}
                            width={gridCardW}
                          />
                          {/* Selected checkmark badge (web parity) */}
                          <View style={[styles.coverCheck, active && styles.coverCheckOn]}>
                            {active && <Text style={styles.coverCheckMark}>✓</Text>}
                          </View>
                        </View>
                        <Text style={[styles.coverName, active && { color: colors.primary }]}>{t(c.nameKey)}</Text>
                        <Text style={styles.coverDesc}>{t(c.descKey)}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={[styles.switchRow, shadows.soft]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>{t("cover.avatarOnCover")}</Text>
                    <Text style={styles.switchDesc}>{t("cover.avatarDesc")}</Text>
                  </View>
                  <Switch
                    value={showAvatar}
                    onValueChange={setShowAvatar}
                    trackColor={{ false: "#d1d5db", true: colors.primary }}
                    thumbColor={colors.white}
                  />
                </View>
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.sectionLabel}>{t("bookBuilder.typography")}</Text>
                <FontSelector selected={font} onSelect={setFont} />

                <Text style={styles.sectionLabel}>{t("bookBuilder.fontSize")}</Text>
                <View style={[styles.segment, shadows.soft]}>
                  {FONT_SIZE_OPTS.map((opt, i) => {
                    const active = fontSize === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        style={[styles.segmentItem, active && styles.segmentItemActive, i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.glassBorder }]}
                        onPress={() => setFontSize(opt.id)}
                      >
                        <Text style={[styles.segmentText, active && { color: colors.white, fontFamily: appFonts.bodyBold }]}>
                          {t(opt.key)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <PageStyleSelector
                  background={background}
                  layout={layout}
                  watermark={watermark}
                  onBackgroundChange={setBackground}
                  onLayoutChange={setLayout}
                  onWatermarkChange={setWatermark}
                />

                <Text style={styles.sectionLabel}>{t("bookBuilder.photoSizePdf")}</Text>
                <View style={styles.photoSizeRow}>
                  {PHOTO_SIZE_OPTS.map((opt) => {
                    const active = photoSize === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        style={[styles.photoSizeCard, active && styles.photoSizeCardActive]}
                        onPress={() => setPhotoSize(opt.id)}
                      >
                        <Text style={styles.photoSizeEmoji}>{opt.emoji}</Text>
                        <Text style={[styles.photoSizeLabel, active && { color: colors.primary, fontFamily: appFonts.bodyBold }]}>
                          {t(opt.key)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {step === 4 && (
              <>
                {/* Book preview — cover / entry page / back cover */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewScroller}>
                  <View style={styles.previewCard}>
                    <CoverPreviewCard
                      cover={cover}
                      userName={customTitle.trim() || displayName || "My Soul Journal"}
                      yearRange={yearRange}
                      avatarUrl={avatarUrl}
                      showAvatar={showAvatar}
                      width={230}
                    />
                    <Text style={styles.previewLabel}>{t("preview.cover")}</Text>
                  </View>

                  <View style={styles.previewCard}>
                    <View style={[styles.entryPageCard, { width: 230, height: 326 }]}>
                      <Text style={[styles.entryPageTitle, { fontFamily: getBookFontConfig(font).appFamily }]}>
                        {t("preview.morningReflection")}
                      </Text>
                      <Text style={styles.entryPageDate}>{new Date().toLocaleDateString(localeFor(language), { weekday: "long", month: "long", day: "numeric" })}</Text>
                      <View style={styles.entryPageMood}>
                        <Text style={{ fontSize: 26 }}>{MOOD_EMOJI.happy}</Text>
                        <Text style={styles.entryPageMoodText}>Happy</Text>
                      </View>
                      <Text style={[styles.entryPageBody, { fontFamily: getBookFontConfig(font).appFamily }]} numberOfLines={6}>
                        {t("preview.sampleBody")}
                      </Text>
                    </View>
                    <Text style={styles.previewLabel}>{t("preview.entryPage")}</Text>
                  </View>

                  <View style={styles.previewCard}>
                    <View style={[styles.backCoverCard, { width: 230, height: 326 }]}>
                      <Text style={[styles.backQuote, { fontFamily: getBookFontConfig(font).appFamily }]}>
                        “{t("preview.backCoverQuote")}”
                      </Text>
                      <View style={styles.backLine} />
                      <Text style={styles.backBrand}>
                        {t("preview.createdWith").replace("{year}", String(new Date().getFullYear()))}
                      </Text>
                    </View>
                    <Text style={styles.previewLabel}>{t("preview.backCover")}</Text>
                  </View>
                </ScrollView>

                {/* Summary rows */}
                <View style={[styles.summaryCard, shadows.soft]}>
                  {[
                    { k: t("bookBuilder.entries"), v: entryCount !== null ? String(entryCount) : "—" },
                    { k: t("bookBuilder.cover"), v: t(`cover.${cover}`) },
                    { k: t("bookBuilder.font"), v: getBookFontConfig(font).name },
                    { k: t("bookBuilder.fontSize"), v: t(`bookBuilder.fontSize${fontSize.charAt(0).toUpperCase()}${fontSize.slice(1)}`) },
                    { k: t("bookBuilder.layout"), v: t(LAYOUT_SUMMARY_KEY[layout]) },
                  ].map((row, i) => (
                    <View key={row.k} style={[styles.summaryRow, i > 0 && styles.summaryRowBorder]}>
                      <Text style={styles.summaryKey}>{row.k}</Text>
                      <Text style={styles.summaryVal}>{row.v}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          {/* Fixed footer — Continue (steps 1-3) / Preview + Generate (step 4) */}
          <View style={styles.footer}>
            {step < 4 ? (
              <Pressable
                style={[styles.continueBtn, shadows.soft, !canContinue && { opacity: 0.5 }]}
                onPress={goNext}
                disabled={!canContinue}
              >
                <Text style={styles.continueText}>{t("bookBuilder.continue")} →</Text>
              </Pressable>
            ) : (
              <View style={styles.footerActions}>
                <Pressable
                  style={[styles.previewBtn, shadows.soft, previewing && { opacity: 0.6 }]}
                  onPress={generatePreview}
                  disabled={previewing}
                >
                  <Text style={styles.previewBtnText}>
                    {previewing ? t("bookBuilder.generatingPreview") : `👁 ${t("bookBuilder.previewEntryPage")}`}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.generateBtn, shadows.soft, building && { opacity: 0.75 }]}
                  onPress={generateBook}
                  disabled={building}
                >
                  {building ? (
                    <View style={styles.generateInner}>
                      <ActivityIndicator color={colors.white} size="small" />
                      <Text style={styles.generateText}>{progress}</Text>
                    </View>
                  ) : (
                    <Text style={styles.generateText}>✨ {t("bookBuilder.generateBook")}</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </>
      )}

      {/* Date pickers */}
      {Platform.OS === "ios" && pickerField && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setPickerField(null)}>
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerCard, shadows.soft]}>
              <Text style={styles.pickerTitle}>{t(pickerField === "from" ? "bookBuilder.from" : "bookBuilder.to")}</Text>
              <DateTimePicker
                value={pickerField === "from" ? (startDate ?? new Date()) : (endDate ?? new Date())}
                mode="date"
                display="inline"
                locale={localeFor(language)}
                maximumDate={pickerField === "from" ? (endDate ?? undefined) : undefined}
                /* iOS: force light theme + dark text so labels never render white-on-white (2026-08-19) */
                themeVariant="light"
                textColor="#111827"
                accentColor={colors.primary}
                onChange={(e, d) => { if (d) setDateField(pickerField, d); }}
              />
              <Pressable style={styles.pickerDone} onPress={() => setPickerField(null)}>
                <Text style={styles.pickerDoneText}>✓ {t("bookBuilder.continue")}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
      {Platform.OS === "android" && pickerField && (
        <DateTimePicker
          value={pickerField === "from" ? (startDate ?? new Date()) : (endDate ?? new Date())}
          mode="date"
          display="default"
          maximumDate={pickerField === "from" ? (endDate ?? undefined) : undefined}
          onChange={(e, d) => { if (d) setDateField(pickerField, d); else setPickerField(null); }}
        />
      )}

      {/* Entry page preview modal */}
      <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
        <LinearGradient colors={[colors.bgTop, colors.bgMid, colors.bgBottom]} style={styles.previewModalRoot}>
          <View style={styles.previewModalHeader}>
            <Text style={styles.previewModalTitle}>{t("bookBuilder.entryPagePreview")}</Text>
            <Pressable style={styles.iconBtn} onPress={() => setPreviewOpen(false)}>
              <Text style={styles.iconBtnText}>✕</Text>
            </Pressable>
          </View>
          <View style={[styles.previewWebWrap, shadows.soft]}>
            <WebView
              originWhitelist={["*"]}
              source={{ html: previewHTML }}
              style={styles.previewWeb}
              javaScriptEnabled={false}
              domStorageEnabled={false}
            />
          </View>
          <Text style={styles.previewNote}>{t("bookBuilder.previewNote")}</Text>
        </LinearGradient>
      </Modal>
    </LinearGradient>
  );
}

const makeStyles = (appFonts: AppFonts) => StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 14, marginBottom: 10 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: colors.cardGlassStrong, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.glassBorder,
  },
  iconBtnText: { fontSize: 18, color: colors.primary, fontFamily: appFonts.bodyBold },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 18, color: colors.text, fontFamily: appFonts.displayBold },
  headerStep: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: appFonts.body },
  progressRow: { flexDirection: "row", gap: 6, paddingHorizontal: 20, marginBottom: 8 },
  progressSeg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.glassBorder },
  progressSegActive: { backgroundColor: colors.primary },
  stepIntro: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  stepIcon: { fontSize: 34 },
  stepTitle: { fontSize: 17, color: colors.text, fontFamily: appFonts.displayBold },
  stepDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 18, marginTop: 2, fontFamily: appFonts.body },

  /* Step 1 */
  dateCard: {
    ...glassCard, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center",
    borderRadius: radius.card,
  },
  dateLabel: { fontSize: 12, color: colors.textMuted, fontFamily: appFonts.bodySemiBold, width: 56 },
  dateValue: { flex: 1, fontSize: 15, color: colors.text, fontFamily: appFonts.bodySemiBold },
  datePlaceholder: { color: colors.textFaint, fontFamily: appFonts.body },
  dateCaret: { fontSize: 18 },
  countRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 6 },
  countText: { fontSize: 13, color: colors.textMuted, fontFamily: appFonts.body },

  /* Step 2 */
  sectionLabel: { fontSize: 13, color: colors.textMuted, marginBottom: 10, marginTop: 16, fontFamily: appFonts.bodySemiBold },
  titleInput: {
    ...glassCard, borderRadius: radius.input, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: colors.text, fontFamily: appFonts.bodySemiBold,
  },
  coverGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 2 },
  coverCell: { width: "31%", marginBottom: 4 },
  coverCellCard: { borderRadius: radius.card, padding: 5, backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 2, borderColor: "transparent" },
  coverCellActive: { borderColor: colors.primary },
  coverCheck: {
    position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#ffffff", borderWidth: 1.5, borderColor: "#d6d3d1",
    alignItems: "center", justifyContent: "center",
  },
  coverCheckOn: { backgroundColor: "#059669", borderColor: "#059669" }, // emerald (Amer's design rule)
  coverCheckMark: { color: "#ffffff", fontSize: 12, fontWeight: "800", lineHeight: 14 },
  coverName: { fontSize: 13, color: colors.text, textAlign: "center", marginTop: 6, fontFamily: appFonts.bodySemiBold },
  coverDesc: { fontSize: 10, color: colors.textFaint, textAlign: "center", marginTop: 1, fontFamily: appFonts.body, lineHeight: 13 },
  switchRow: { ...glassCard, borderRadius: radius.card, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  switchLabel: { fontSize: 14, color: colors.text, fontFamily: appFonts.bodySemiBold },
  switchDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: appFonts.body },

  /* Step 3 */
  segment: { flexDirection: "row", borderRadius: radius.input, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.6)" },
  segmentItem: { flex: 1, paddingVertical: 13, alignItems: "center" },
  segmentItemActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, color: colors.textMuted, fontFamily: appFonts.bodySemiBold },
  photoSizeRow: { flexDirection: "row", gap: 10 },
  photoSizeCard: {
    flex: 1, borderRadius: radius.card, paddingVertical: 14, alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.55)", borderWidth: 2, borderColor: "transparent",
  },
  photoSizeCardActive: { borderColor: colors.primary, backgroundColor: "rgba(29,129,237,0.08)" },
  photoSizeEmoji: { fontSize: 22, marginBottom: 4 },
  photoSizeLabel: { fontSize: 12, color: colors.textMuted, textAlign: "center", fontFamily: appFonts.bodySemiBold, paddingHorizontal: 4 },

  /* Step 4 */
  previewScroller: { gap: 14, paddingBottom: 8 },
  previewCard: { alignItems: "center", width: 230 },
  previewLabel: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontFamily: appFonts.bodySemiBold, letterSpacing: 0.4 },
  entryPageCard: { backgroundColor: "#ffffff", borderRadius: 14, padding: 18, overflow: "hidden" },
  entryPageTitle: { fontSize: 17, color: "#0a0a0a", marginBottom: 4 },
  entryPageDate: { fontSize: 9, color: "#9ca3af", fontStyle: "italic", marginBottom: 8 },
  entryPageMood: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  entryPageMoodText: { fontSize: 11, color: "#374151", backgroundColor: "#f5f5f5", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, fontFamily: "Inter_500Medium" },
  entryPageBody: { fontSize: 11, color: "#374151", lineHeight: 17 },
  backCoverCard: { backgroundColor: "#f5f5f4", borderRadius: 14, padding: 22, alignItems: "center", justifyContent: "center" },
  backQuote: { fontSize: 15, color: "#78716c", textAlign: "center", lineHeight: 22, fontStyle: "italic" },
  backLine: { width: 40, height: 1, backgroundColor: "#d6d3d1", marginVertical: 12 },
  backBrand: { fontSize: 9, color: "#a8a29e", letterSpacing: 1.2 },
  summaryCard: { ...glassCard, borderRadius: radius.card, marginTop: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11, paddingHorizontal: 16 },
  summaryRowBorder: { borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.05)" },
  summaryKey: { fontSize: 13, color: colors.textMuted, fontFamily: appFonts.body },
  summaryVal: { fontSize: 13, color: colors.text, fontFamily: appFonts.bodySemiBold, maxWidth: "60%", textAlign: "right" },

  /* Footer */
  footer: { padding: 16, paddingTop: 10, backgroundColor: "rgba(255,255,255,0.72)", borderTopWidth: 1, borderTopColor: colors.glassBorder },
  continueBtn: { backgroundColor: colors.primary, borderRadius: radius.input, paddingVertical: 16, alignItems: "center" },
  continueText: { color: colors.white, fontSize: 16, fontFamily: appFonts.bodyBold },
  footerActions: { flexDirection: "row", gap: 10 },
  previewBtn: {
    flex: 1, borderRadius: radius.input, paddingVertical: 15, alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1.5, borderColor: colors.primary,
  },
  previewBtnText: { color: colors.primary, fontSize: 14, fontFamily: appFonts.bodyBold, textAlign: "center" },
  generateBtn: { flex: 1.6, borderRadius: radius.input, paddingVertical: 15, alignItems: "center", backgroundColor: colors.primary },
  generateInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  generateText: { color: colors.white, fontSize: 14, fontFamily: appFonts.bodyBold, textAlign: "center" },

  /* Date picker modal */
  pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  pickerCard: { backgroundColor: colors.white, borderRadius: radius.card, padding: 18 },
  pickerTitle: { fontSize: 16, color: colors.text, fontFamily: appFonts.displayBold, textAlign: "center", marginBottom: 10 },
  pickerDone: { marginTop: 12, backgroundColor: colors.primary, borderRadius: radius.input, paddingVertical: 13, alignItems: "center" },
  pickerDoneText: { color: colors.white, fontSize: 15, fontFamily: appFonts.bodyBold },

  /* Preview modal */
  previewModalRoot: { flex: 1, paddingTop: 60 },
  previewModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 14 },
  previewModalTitle: { fontSize: 18, color: colors.text, fontFamily: appFonts.displayBold },
  previewWebWrap: {
    marginHorizontal: 20, borderRadius: radius.card, overflow: "hidden",
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.glassBorder,
  },
  previewWeb: { width: "100%", aspectRatio: 420 / 595, backgroundColor: colors.white },
  previewNote: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: 14, paddingHorizontal: 28, lineHeight: 19, fontFamily: appFonts.body },
});
