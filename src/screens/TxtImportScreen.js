import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import DocumentPicker from "react-native-document-picker";
import RNFS from "react-native-fs";
import { COLORS, TYPO } from "../data/constants";
import { synthesizeChapter, getAudioExtForMode } from "../data/tts";
import {
  detectChapters,
  detectBookName,
  sanitizeChapterFilename,
  looksLikeGbkDecodedAsUtf8,
} from "../data/txtChapterParser";
import { computeBookDir } from "../data/ocrNovels";
import OcrChapterEditScreen from "./OcrChapterEditScreen";

const OCR_DIR = `${RNFS.DocumentDirectoryPath}/ocr-novels`;

function TxtImportScreen({ onComplete, onCancel }) {
  const [tempBookId] = useState(() => `ocr-${Date.now()}`);
  const [step, setStep] = useState("pick-file");
  const [chapters, setChapters] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [bookTitle, setBookTitle] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const bookDir = `${OCR_DIR}/${tempBookId}`;

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.pick({
        type: ["public.plain-text"],
      });
      const file = Array.isArray(res) ? res[0] : res;
      if (!file) return;
      await parseFile(file.uri, file.name || "未命名.txt");
    } catch (e) {
      if (DocumentPicker.isCancel(e)) return;
      Alert.alert("选择文件失败", e.message || "");
    }
  };

  const parseFile = async (uri, name) => {
    setStep("parsing");
    try {
      const filePath = uri.startsWith("file://")
        ? decodeURIComponent(uri.slice(7))
        : uri;
      const text = await RNFS.readFile(filePath, "utf8");
      if (looksLikeGbkDecodedAsUtf8(text)) {
        Alert.alert(
          "编码不支持",
          "文件可能是 GBK 编码，目前仅支持 UTF-8，请先用其他工具转换",
          [{ text: "好的", onPress: () => setStep("pick-file") }]
        );
        return;
      }
      const detected = detectChapters(text);
      setChapters(
        detected.map((ch, i) => ({
          id: `ch-${i}`,
          title: ch.title,
          text: ch.body,
          sourceImagePath: "",
          audioPath: "",
          ocrFailed: false,
        }))
      );
      setBookTitle(detectBookName(name));
      setStep("edit-chapters");
    } catch (e) {
      Alert.alert("无法读取文件", e.message || "", [
        { text: "好的", onPress: () => setStep("pick-file") },
      ]);
    }
  };

  const updateChapterTitle = (i, title) => {
    setChapters((prev) => prev.map((ch, idx) => (idx === i ? { ...ch, title } : ch)));
  };

  const saveChapterEdit = (text) => {
    setChapters((prev) =>
      prev.map((ch, i) => (i === editingIndex ? { ...ch, text } : ch))
    );
    setEditingIndex(null);
  };

  const onSplitHere = (fullText, cursorPos) => {
    const before = fullText.slice(0, cursorPos);
    const after = fullText.slice(cursorPos);
    if (!before.trim() || !after.trim()) {
      Alert.alert("拆分位置无效", "请把光标放在段落中间");
      return;
    }
    setChapters((prev) => {
      const next = [...prev];
      next[editingIndex] = { ...next[editingIndex], text: before };
      next.splice(editingIndex + 1, 0, {
        id: `ch-${Date.now()}`,
        title: `第 ${editingIndex + 2} 章`,
        text: after,
        sourceImagePath: "",
        audioPath: "",
        ocrFailed: false,
      });
      return next;
    });
    setEditingIndex(null);
  };

  const mergeWithNext = (i) => {
    if (i >= chapters.length - 1) return;
    setChapters((prev) => {
      const next = [...prev];
      next[i] = {
        ...next[i],
        text: next[i].text + "\n\n" + next[i + 1].text,
      };
      next.splice(i + 1, 1);
      return next;
    });
  };

  const deleteChapter = (i) => {
    Alert.alert("删除章节", `确定删除「${chapters[i].title}」？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          setChapters((prev) => prev.filter((_, idx) => idx !== i));
        },
      },
    ]);
  };

  const cleanupAndCancel = async () => {
    try {
      await RNFS.unlink(bookDir);
    } catch {}
    onCancel();
  };

  const handleBack = () => {
    if (step === "pick-file") {
      onCancel();
      return;
    }
    Alert.alert("放弃本次导入？", "已生成的文件会清理", [
      { text: "继续导入", style: "cancel" },
      { text: "放弃", style: "destructive", onPress: cleanupAndCancel },
    ]);
  };

  const runTts = async () => {
    if (!bookTitle.trim()) {
      Alert.alert("请输入书名");
      return;
    }
    setStep("tts-generating");
    setProgress({ current: 0, total: chapters.length });
    const audioExt = await getAudioExtForMode();
    await RNFS.mkdir(bookDir);

    const completedChapters = [];
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      if (!ch.text.trim()) {
        setProgress({ current: i + 1, total: chapters.length });
        continue;
      }
      const safeTitle = sanitizeChapterFilename(ch.title, i);
      const audioPath = `file://${bookDir}/${safeTitle}.${audioExt}`;
      try {
        await synthesizeChapter(ch.text, audioPath.replace("file://", ""));
        completedChapters.push({
          ...ch,
          id: `ch-${i}`,
          audioPath,
        });
      } catch (e) {
        const action = await new Promise((resolve) => {
          Alert.alert(
            `${ch.title}合成失败`,
            e.message || "未知错误",
            [
              { text: "重试", onPress: () => resolve("retry") },
              { text: "跳过该章", onPress: () => resolve("skip") },
              { text: "取消导入", onPress: () => resolve("cancel"), style: "cancel" },
            ]
          );
        });
        if (action === "retry") {
          i--;
          continue;
        } else if (action === "skip") {
        } else {
          cleanupAndCancel();
          return;
        }
      }
      setProgress({ current: i + 1, total: chapters.length });
    }

    if (completedChapters.length === 0) {
      Alert.alert("合成失败", "所有章节均合成失败");
      return;
    }

    let finalDir = bookDir;
    try {
      const computed = await computeBookDir(bookTitle, tempBookId);
      if (computed !== bookDir) {
        await RNFS.moveFile(bookDir, computed);
        finalDir = computed;
      }
    } catch {
      finalDir = bookDir;
    }

    const book = {
      id: tempBookId,
      title: bookTitle.trim(),
      coverImage: "",
      chapters: completedChapters.map((ch) => ({
        ...ch,
        audioPath: ch.audioPath.replace(bookDir, finalDir),
      })),
      createdAt: Date.now(),
      isOCR: true,
      bookDir: `file://${finalDir}`,
    };
    onComplete(book);
  };

  const headerTitle = () => {
    switch (step) {
      case "pick-file": return "导入 TXT";
      case "parsing": return "解析中";
      case "edit-chapters": return `编辑章节 (${chapters.length})`;
      case "name-book": return "命名小说";
      case "tts-generating": return "合成语音";
      default: return "导入 TXT";
    }
  };

  const stepIndex = () => {
    switch (step) {
      case "pick-file": return 0;
      case "parsing": return 0;
      case "edit-chapters": return 1;
      case "name-book": return 2;
      case "tts-generating": return 3;
      default: return 0;
    }
  };

  const STEP_LABELS = ["选择文件", "编辑章节", "命名", "合成"];

  if (editingIndex !== null) {
    return (
      <OcrChapterEditScreen
        chapterTitle={chapters[editingIndex]?.title || `第 ${editingIndex + 1} 章`}
        initialText={chapters[editingIndex]?.text || ""}
        onSave={saveChapterEdit}
        onBack={() => setEditingIndex(null)}
        onSplitHere={onSplitHere}
      />
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} style={s.backBtn}>
            <Text style={s.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.title}>{headerTitle()}</Text>
          <View style={s.headerSpacer} />
        </View>

        {step !== "pick-file" && step !== "parsing" && (
          <View style={s.stepBar}>
            {STEP_LABELS.map((label, i) => (
              <View key={i} style={s.stepItem}>
                <View style={[s.stepDot, i <= stepIndex() && s.stepDotActive]} />
                <Text style={[s.stepLabel, i <= stepIndex() && s.stepLabelActive]}>
                  {label}
                </Text>
                {i < STEP_LABELS.length - 1 && (
                  <View style={[s.stepLine, i < stepIndex() && s.stepLineActive]} />
                )}
              </View>
            ))}
          </View>
        )}

        {step === "pick-file" && (
          <View style={s.center}>
            <View style={s.iconCircle}>
              <Text style={s.iconText}>TXT</Text>
            </View>
            <Text style={s.sectionTitle}>选择文本文件</Text>
            <Text style={s.sectionHint}>
              支持 UTF-8 编码的 .txt 文件{"\n"}将自动按章节标题分章
            </Text>
            <TouchableOpacity onPress={pickFile} style={s.pickBtn} activeOpacity={0.7}>
              <View style={s.pickBtnIcon}>
                <Text style={s.pickBtnIconText}>📄</Text>
              </View>
              <View style={s.pickBtnContent}>
                <Text style={s.pickBtnTitle}>选择 TXT 文件</Text>
                <Text style={s.pickBtnSub}>从文件中选取</Text>
              </View>
              <Text style={s.pickBtnArrow}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === "parsing" && (
          <View style={s.center}>
            <ActivityIndicator size="large" color={COLORS.accentNovel} />
            <Text style={s.sectionHint}>正在解析章节…</Text>
          </View>
        )}

        {step === "edit-chapters" && (
          <View style={s.flex}>
            <ScrollView contentContainerStyle={s.listContent}>
              {chapters.length === 0 && (
                <Text style={s.emptyHint}>未检测到章节</Text>
              )}
              {chapters.map((ch, i) => (
                <View key={i} style={s.chapterCard}>
                  <View style={s.chapterCardTop}>
                    <View style={s.chapterIndex}>
                      <Text style={s.chapterIndexText}>{i + 1}</Text>
                    </View>
                    <TextInput
                      style={s.titleInput}
                      value={ch.title}
                      onChangeText={(t) => updateChapterTitle(i, t)}
                      placeholder={`第 ${i + 1} 章`}
                      placeholderTextColor={COLORS.tertiaryText}
                    />
                  </View>
                  <Text style={s.preview} numberOfLines={2}>
                    {ch.text.slice(0, 80) || "（空）"}
                  </Text>
                  <View style={s.btnRow}>
                    <TouchableOpacity
                      onPress={() => setEditingIndex(i)}
                      style={s.actionBtn}
                    >
                      <Text style={s.actionBtnText}>编辑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => mergeWithNext(i)}
                      style={[
                        s.actionBtn,
                        i >= chapters.length - 1 && s.actionBtnDisabled,
                      ]}
                      disabled={i >= chapters.length - 1}
                    >
                      <Text style={[s.actionBtnText, i >= chapters.length - 1 && s.actionBtnTextDisabled]}>
                        合并
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteChapter(i)}
                      style={s.actionBtn}
                    >
                      <Text style={[s.actionBtnText, { color: COLORS.accent }]}>删除</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={s.footer}>
              <TouchableOpacity
                onPress={() => setStep("name-book")}
                style={[s.primaryBtn, chapters.length === 0 && s.primaryBtnDisabled]}
                disabled={chapters.length === 0}
              >
                <Text style={s.primaryBtnText}>下一步</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === "name-book" && (
          <View style={s.flex}>
            <ScrollView contentContainerStyle={s.nameContent}>
              <Text style={s.label}>书名</Text>
              <TextInput
                style={s.bookTitleInput}
                value={bookTitle}
                onChangeText={setBookTitle}
                placeholder="请输入书名"
                placeholderTextColor={COLORS.tertiaryText}
                autoFocus
              />
              <View style={s.summaryCard}>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>章节数</Text>
                  <Text style={s.summaryValue}>{chapters.length} 章</Text>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>总字数</Text>
                  <Text style={s.summaryValue}>
                    {chapters.reduce((sum, ch) => sum + ch.text.length, 0).toLocaleString()} 字
                  </Text>
                </View>
              </View>
              {chapters.length > 50 && (
                <View style={s.warningCard}>
                  <Text style={s.warningIcon}>!</Text>
                  <Text style={s.warningText}>章节较多，合成可能需要较长时间</Text>
                </View>
              )}
            </ScrollView>
            <View style={s.footer}>
              <View style={s.btnRow}>
                <TouchableOpacity onPress={() => setStep("edit-chapters")} style={s.outlineBtn}>
                  <Text style={s.outlineBtnText}>上一步</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={runTts}
                  style={[s.primaryBtn, s.primaryBtnFlex]}
                >
                  <Text style={s.primaryBtnText}>开始合成</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {step === "tts-generating" && (
          <View style={s.center}>
            <ActivityIndicator size="large" color={COLORS.accentNovel} />
            <Text style={s.progressLabel}>
              {progress.current}/{progress.total}
            </Text>
            <Text style={s.progressHint}>
              {progress.current < progress.total
                ? `正在合成第 ${progress.current + 1} 章…`
                : "合成完成"}
            </Text>
            <View style={s.progressBar}>
              <View
                style={[
                  s.progressFill,
                  {
                    width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
                  },
                ]}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  backText: {
    color: COLORS.accentNovel,
    fontSize: 24,
    fontWeight: "300",
    lineHeight: 28,
  },
  title: {
    ...TYPO.titleMedium,
    color: COLORS.primaryText,
  },
  headerSpacer: { width: 36 },
  stepBar: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.separator,
  },
  stepItem: {
    flex: 1,
    alignItems: "center",
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.separator,
    marginBottom: 4,
  },
  stepDotActive: {
    backgroundColor: COLORS.accentNovel,
  },
  stepLabel: {
    fontSize: 10,
    color: COLORS.tertiaryText,
  },
  stepLabelActive: {
    color: COLORS.accentNovel,
    fontWeight: "600",
  },
  stepLine: {
    position: "absolute",
    top: 4,
    left: "50%",
    width: "100%",
    height: 1,
    backgroundColor: COLORS.separator,
    zIndex: -1,
  },
  stepLineActive: {
    backgroundColor: COLORS.accentNovel,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accentNovel + "18",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  iconText: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.accentNovel,
    letterSpacing: 1,
  },
  sectionTitle: {
    ...TYPO.titleLarge,
    color: COLORS.primaryText,
    marginBottom: 8,
  },
  sectionHint: {
    color: COLORS.secondaryText,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  emptyHint: {
    color: COLORS.tertiaryText,
    textAlign: "center",
    marginTop: 40,
    fontSize: 14,
  },
  chapterCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.separator,
  },
  chapterCardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  chapterIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accentNovel + "1A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  chapterIndexText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.accentNovel,
  },
  titleInput: {
    flex: 1,
    color: COLORS.primaryText,
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  preview: {
    color: COLORS.secondaryText,
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 34,
    marginBottom: 10,
  },
  btnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    paddingLeft: 34,
  },
  actionBtn: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: COLORS.separator,
  },
  actionBtnText: {
    color: COLORS.primaryText,
    fontSize: 12,
    fontWeight: "500",
  },
  actionBtnDisabled: {
    opacity: 0.35,
  },
  actionBtnTextDisabled: {
    color: COLORS.tertiaryText,
  },
  nameContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  label: {
    color: COLORS.secondaryText,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bookTitleInput: {
    color: COLORS.primaryText,
    fontSize: 18,
    fontWeight: "600",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.separator,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.separator,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  summaryLabel: {
    color: COLORS.secondaryText,
    fontSize: 14,
  },
  summaryValue: {
    color: COLORS.primaryText,
    fontSize: 14,
    fontWeight: "600",
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.separator,
    marginVertical: 8,
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
    gap: 10,
  },
  warningIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E65100",
    color: "#FFF",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
  },
  warningText: {
    color: "#BF360C",
    fontSize: 13,
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  primaryBtn: {
    backgroundColor: COLORS.accentNovel,
    paddingVertical: 15,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: COLORS.accentNovel + "40",
    width: "100%",
    maxWidth: 320,
  },
  pickBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.accentNovel + "14",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  pickBtnIconText: {
    fontSize: 22,
  },
  pickBtnContent: {
    flex: 1,
  },
  pickBtnTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primaryText,
    marginBottom: 2,
  },
  pickBtnSub: {
    fontSize: 13,
    color: COLORS.secondaryText,
  },
  pickBtnArrow: {
    fontSize: 24,
    color: COLORS.accentNovel,
    fontWeight: "300",
    marginLeft: 8,
  },
  primaryBtnFlex: { flex: 1 },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  outlineBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: COLORS.accentNovel,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: {
    color: COLORS.accentNovel,
    fontSize: 15,
    fontWeight: "600",
  },
  progressLabel: {
    ...TYPO.titleLarge,
    color: COLORS.primaryText,
    marginTop: 16,
  },
  progressHint: {
    color: COLORS.secondaryText,
    fontSize: 14,
    marginTop: 6,
  },
  progressBar: {
    width: "70%",
    height: 6,
    backgroundColor: COLORS.separator,
    borderRadius: 3,
    marginTop: 20,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.accentNovel,
    borderRadius: 3,
  },
});

export default TxtImportScreen;
