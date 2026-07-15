import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import Slider from "@react-native-community/slider";
import { COLORS, TYPO } from "../data/constants";
import {
  getVoices,
  previewVoice,
  loadTTSSettings,
  saveTTSSettings,
} from "../data/tts";

const PREVIEW_TEXT = "这是一段试听文本，用于预览语音效果。";

function qualityLabel(q) {
  if (q === "premium") return "Premium";
  if (q === "enhanced") return "Enhanced";
  if (q === "compact") return "Compact";
  return "Default";
}

function rateLabel(rate) {
  if (rate === 0) return "默认";
  if (rate > 0) return `+${rate}%`;
  return `${rate}%`;
}

function TTSSettingsScreen({ onBack }) {
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [rate, setRate] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [v, s] = await Promise.all([getVoices(), loadTTSSettings()]);
        setVoices(v || []);
        setSelectedVoice(s.voice);
        setRate(s.rate);
      } catch (e) {
        setVoices([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasPremium = voices.some((v) => v.quality === "premium");

  const handlePreview = useCallback(
    (voiceId) => {
      previewVoice(voiceId, rate, PREVIEW_TEXT).catch(() => {});
    },
    [rate]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveTTSSettings(selectedVoice, rate);
      Alert.alert("已保存", null, [{ text: "好的", onPress: onBack }]);
    } catch (e) {
      Alert.alert("保存失败", (e && e.message) || "请重试");
    } finally {
      setSaving(false);
    }
  }, [selectedVoice, rate, onBack]);

  const groups = voices.reduce((acc, v) => {
    const q = v.quality || "default";
    if (!acc[q]) acc[q] = [];
    acc[q].push(v);
    return acc;
  }, {});
  const groupOrder = ["premium", "enhanced", "compact", "default"];
  const orderedGroups = groupOrder
    .filter((q) => groups[q] && groups[q].length > 0)
    .map((q) => ({ quality: q, voices: groups[q] }));

  const renderVoiceRow = (key, name, lang, identifier) => {
    const isSelected = selectedVoice === identifier;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.voiceRow, isSelected && styles.voiceRowActive]}
        onPress={() => setSelectedVoice(identifier)}
      >
        <View style={styles.radioOuter}>
          {isSelected && <View style={styles.radioInner} />}
        </View>
        <View style={styles.voiceInfo}>
          <Text style={styles.voiceName}>{name}</Text>
          <Text style={styles.voiceLang}>{lang}</Text>
        </View>
        <TouchableOpacity
          style={styles.previewBtn}
          onPress={() => handlePreview(identifier)}
        >
          <Text style={styles.previewBtnText}>试听</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Text style={styles.headerIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, TYPO.titleMedium]}>TTS 语音</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list}>
          {!hasPremium && (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                未检测到 premium 中文语音包，音质会偏机械。前往{"\n"}
                设置 › 辅助功能 › 朗读内容 › 声音 › 中文（简体）{"\n"}
                下载 Tingting/Lilian 优质语音
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>语速</Text>
            <View style={styles.rateRow}>
              <Slider
                style={styles.slider}
                minimumValue={-50}
                maximumValue={50}
                step={5}
                value={rate}
                onValueChange={setRate}
                onSlidingComplete={() => handlePreview(selectedVoice)}
                minimumTrackTintColor={COLORS.accent}
                maximumTrackTintColor={COLORS.tertiaryText}
              />
              <Text style={styles.rateValue}>{rateLabel(rate)}</Text>
            </View>
          </View>

          {voices.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                未找到中文语音包，请在系统设置中下载
              </Text>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>语音</Text>
              {renderVoiceRow("default", "系统默认", "自动选择最佳 premium", "")}
              {orderedGroups.map((group) => (
                <View key={group.quality}>
                  <Text style={styles.groupTitle}>
                    {qualityLabel(group.quality)}
                  </Text>
                  {group.voices.map((v) =>
                    renderVoiceRow(v.identifier, v.name, v.language, v.identifier)
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "保存中..." : "保存"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerIcon: { color: COLORS.primaryText, fontSize: 24 },
  title: { flex: 1, color: COLORS.primaryText, textAlign: "center", marginHorizontal: 8 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  banner: {
    backgroundColor: "#FFF3CD",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  bannerText: { color: "#856404", fontSize: 13, lineHeight: 18 },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.secondaryText,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  rateRow: { flexDirection: "row", alignItems: "center" },
  slider: { flex: 1, height: 40 },
  rateValue: {
    color: COLORS.primaryText,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 12,
    minWidth: 50,
    textAlign: "right",
  },
  empty: { padding: 24, alignItems: "center" },
  emptyText: { color: COLORS.secondaryText, fontSize: 14, textAlign: "center" },
  groupTitle: {
    color: COLORS.tertiaryText,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
  },
  voiceRowActive: { backgroundColor: COLORS.background },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.accent,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
  voiceInfo: { flex: 1 },
  voiceName: { color: COLORS.primaryText, fontSize: 15, fontWeight: "500" },
  voiceLang: { color: COLORS.secondaryText, fontSize: 12, marginTop: 2 },
  previewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    borderRadius: 6,
  },
  previewBtnText: { color: COLORS.accent, fontSize: 13, fontWeight: "600" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

export default TTSSettingsScreen;
