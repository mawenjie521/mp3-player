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
} from "react-native";
import DocumentPicker from "react-native-document-picker";
import RNFS from "react-native-fs";
import { COLORS } from "../data/constants";
import { synthesizeChapter } from "../data/tts";
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
      const text = await RNFS.readFile(uri, "utf8");
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
    } catch {
      // folder may not exist yet
    }
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
    await RNFS.mkdir(bookDir);

    const completedChapters = [];
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      if (!ch.text.trim()) {
        setProgress({ current: i + 1, total: chapters.length });
        continue;
      }
      const safeTitle = sanitizeChapterFilename(ch.title, i);
      const audioPath = `file://${bookDir}/${safeTitle}.m4a`;
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
          // don't add this chapter
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
      case "edit-chapters": return `章节列表 (${chapters.length} 章)`;
      case "name-book": return "命名小说";
      case "tts-generating": return "合成语音";
      default: return "导入 TXT";
    }
  };

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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{headerTitle()}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {step === "pick-file" && (
        <View style={styles.center}>
          <TouchableOpacity onPress={pickFile} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>选择 TXT 文件</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>仅支持 UTF-8 编码的 .txt 文件</Text>
        </View>
      )}

      {step === "parsing" && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accentNovel} />
          <Text style={styles.hint}>解析中…</Text>
        </View>
      )}

      {step === "edit-chapters" && (
        <View style={styles.body}>
          <ScrollView contentContainerStyle={styles.listContent}>
            {chapters.map((ch, i) => (
              <View key={i} style={styles.chapterCard}>
                <TextInput
                  style={styles.titleInput}
                  value={ch.title}
                  onChangeText={(t) => updateChapterTitle(i, t)}
                  placeholder={`第 ${i + 1} 章`}
                  placeholderTextColor={COLORS.secondaryText}
                />
                <Text style={styles.preview} numberOfLines={1}>
                  {ch.text.slice(0, 30) || "（空）"}
                </Text>
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    onPress={() => setEditingIndex(i)}
                    style={styles.smallBtn}
                  >
                    <Text style={styles.smallBtnText}>编辑正文</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => mergeWithNext(i)}
                    style={[styles.smallBtn, i >= chapters.length - 1 && styles.disabledBtn]}
                    disabled={i >= chapters.length - 1}
                  >
                    <Text style={styles.smallBtnText}>合并↓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteChapter(i)}
                    style={styles.smallBtn}
                  >
                    <Text style={styles.smallBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            onPress={() => setStep("name-book")}
            style={[styles.primaryBtn, chapters.length === 0 && styles.disabledBtn]}
            disabled={chapters.length === 0}
          >
            <Text style={styles.primaryBtnText}>下一步</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === "name-book" && (
        <View style={styles.body}>
          <Text style={styles.label}>书名：</Text>
          <TextInput
            style={styles.bookTitleInput}
            value={bookTitle}
            onChangeText={setBookTitle}
            placeholder="请输入书名"
            placeholderTextColor={COLORS.secondaryText}
          />
          <Text style={styles.hint}>
            共 {chapters.length} 章，预计合成 {chapters.length} 个音频文件
          </Text>
          {chapters.length > 50 && (
            <Text style={styles.warning}>章节较多，合成可能需要较长时间</Text>
          )}
          <TouchableOpacity onPress={runTts} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>开始合成语音</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === "tts-generating" && (
        <View style={styles.center}>
          <Text style={styles.hint}>
            合成语音 {progress.current}/{progress.total}...
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
                },
              ]}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    color: COLORS.accentNovel,
    fontSize: 16,
  },
  title: {
    color: COLORS.primaryText,
    fontSize: 17,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 60,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  hint: {
    color: COLORS.secondaryText,
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
  },
  warning: {
    color: "#cc6600",
    fontSize: 14,
    marginTop: 8,
  },
  label: {
    color: COLORS.primaryText,
    fontSize: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: COLORS.accentNovel,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
    marginTop: 24,
  },
  primaryBtnText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: "600",
  },
  disabledBtn: {
    opacity: 0.4,
  },
  listContent: {
    paddingBottom: 16,
  },
  chapterCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.separator,
  },
  titleInput: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
  },
  bookTitleInput: {
    color: COLORS.primaryText,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.separator,
  },
  preview: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  btnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    gap: 8,
  },
  smallBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.separator,
  },
  smallBtnText: {
    color: COLORS.primaryText,
    fontSize: 13,
  },
  progressBar: {
    width: "80%",
    height: 8,
    backgroundColor: COLORS.separator,
    borderRadius: 4,
    marginTop: 16,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.accentNovel,
  },
});

export default TxtImportScreen;
