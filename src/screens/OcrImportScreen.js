import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { launchImageLibrary, launchCamera } from "react-native-image-picker";
import TextRecognition, { TextRecognitionScript } from "@react-native-ml-kit/text-recognition";
import RNFS from "react-native-fs";
import { COLORS } from "../data/constants";
import { synthesizeChapter } from "../data/tts";
import OcrChapterEditScreen from "./OcrChapterEditScreen";

const OCR_DIR = `${RNFS.DocumentDirectoryPath}/ocr-novels`;

function OcrImportScreen({ onComplete, onCancel }) {
  const [tempBookId] = useState(() => `ocr-${Date.now()}`);
  const [step, setStep] = useState("select-images");
  const [images, setImages] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [bookTitle, setBookTitle] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const bookDir = `${OCR_DIR}/${tempBookId}`;

  const copyImageToSandbox = async (uri, index, isCover) => {
    const ext = uri.match(/\.(\w+)(\?|$)/)?.[1] || "jpg";
    const filename = isCover ? `cover.${ext}` : `source-${index}.${ext}`;
    const dest = `${bookDir}/${filename}`;
    await RNFS.mkdir(bookDir);
    await RNFS.copyFile(uri, dest);
    return `file://${dest}`;
  };

  const pickFromLibrary = async () => {
    const result = await launchImageLibrary({
      selectionLimit: 0,
      mediaType: "photo",
      includeBase64: false,
    });
    if (result.didCancel || !result.assets) return;
    const newUris = result.assets.map((a) => a.uri);
    setImages((prev) => [...prev, ...newUris]);
  };

  const takePhoto = async () => {
    const result = await launchCamera({
      mediaType: "photo",
      includeBase64: false,
    });
    if (result.didCancel || !result.assets) return;
    setImages((prev) => [...prev, result.assets[0].uri]);
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const runOcr = async () => {
    setStep("ocr-processing");
    setProgress({ current: 0, total: images.length });
    await RNFS.mkdir(bookDir);
    const newChapters = [];
    for (let i = 0; i < images.length; i++) {
      try {
        const sandboxUri = await copyImageToSandbox(images[i], i, false);
        const recognition = await TextRecognition.recognize(
          sandboxUri,
          TextRecognitionScript.CHINESE
        );
        newChapters.push({
          id: `ch-${i}`,
          title: `第 ${i + 1} 章`,
          text: recognition.text || "",
          sourceImagePath: sandboxUri,
          audioPath: "",
          ocrFailed: !recognition.text,
        });
      } catch (e) {
        const sandboxUri = await copyImageToSandbox(images[i], i, false);
        newChapters.push({
          id: `ch-${i}`,
          title: `第 ${i + 1} 章`,
          text: "",
          sourceImagePath: sandboxUri,
          audioPath: "",
          ocrFailed: true,
        });
      }
      setProgress({ current: i + 1, total: images.length });
    }
    setChapters(newChapters);
    setStep("edit-chapters");
  };

  const saveChapterEdit = (text) => {
    setChapters((prev) =>
      prev.map((ch, i) => (i === editingIndex ? { ...ch, text, ocrFailed: false } : ch))
    );
    setEditingIndex(null);
  };

  const runTts = async () => {
    if (!bookTitle.trim()) {
      Alert.alert("请输入书名");
      return;
    }
    setStep("tts-generating");
    setProgress({ current: 0, total: chapters.length });

    try {
      if (images.length > 0) {
        await copyImageToSandbox(images[0], 0, true);
      }
    } catch {
      // Cover copy failure is non-fatal
    }

    const coverExt = (images[0]?.match(/\.(\w+)(\?|$)/)?.[1]) || "jpg";
    const coverPath = `file://${bookDir}/cover.${coverExt}`;

    const completedChapters = [];
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      if (!ch.text.trim()) {
        setProgress({ current: i + 1, total: chapters.length });
        continue;
      }
      const audioPath = `file://${bookDir}/${ch.id}.m4a`;
      try {
        await synthesizeChapter(ch.text, audioPath.replace("file://", ""));
        completedChapters.push({ ...ch, audioPath });
      } catch (e) {
        const action = await new Promise((resolve) => {
          Alert.alert(
            `第 ${i + 1} 章合成失败`,
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
          // Don't add this chapter
        } else {
          cleanupAndCancel();
          return;
        }
      }
      setProgress({ current: i + 1, total: chapters.length });
    }

    if (completedChapters.length === 0) {
      Alert.alert("没有可用的章节", "所有章节都合成失败", [
        { text: "确定", onPress: () => cleanupAndCancel() },
      ]);
      return;
    }

    const book = {
      id: tempBookId,
      title: bookTitle.trim(),
      coverImage: coverPath,
      chapters: completedChapters.map((ch, i) => ({
        id: ch.id,
        title: ch.title,
        text: ch.text,
        audioPath: ch.audioPath,
        sourceImagePath: ch.sourceImagePath,
      })),
      createdAt: Date.now(),
      isOCR: true,
    };
    onComplete(book);
  };

  const cleanupAndCancel = async () => {
    try {
      await RNFS.unlink(bookDir);
    } catch {
      // ignore
    }
    onCancel();
  };

  const confirmCancel = () => {
    Alert.alert("放弃本次导入？", "已生成的文件会清理", [
      { text: "继续编辑", style: "cancel" },
      { text: "放弃", onPress: cleanupAndCancel, style: "destructive" },
    ]);
  };

  if (editingIndex !== null) {
    return (
      <OcrChapterEditScreen
        chapterTitle={chapters[editingIndex].title}
        initialText={chapters[editingIndex].text}
        onSave={saveChapterEdit}
        onBack={() => setEditingIndex(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={confirmCancel} style={styles.backBtn}>
          <Text style={styles.backText}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>导入 OCR 小说</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {step === "select-images" && (
          <View>
            <Text style={styles.label}>选择书页图片</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity onPress={pickFromLibrary} style={styles.outlineBtn}>
                <Text style={styles.outlineBtnText}>从相册选择</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={takePhoto} style={styles.outlineBtn}>
                <Text style={styles.outlineBtnText}>拍照</Text>
              </TouchableOpacity>
            </View>
            {images.length > 0 && (
              <ScrollView horizontal style={styles.thumbRow}>
                {images.map((uri, i) => (
                  <View key={i} style={styles.thumbWrap}>
                    <Image source={{ uri }} style={styles.thumb} />
                    <TouchableOpacity
                      onPress={() => removeImage(i)}
                      style={styles.thumbRemove}
                    >
                      <Text style={styles.thumbRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            <Text style={styles.hint}>已选择 {images.length} 张图片</Text>
          </View>
        )}

        {step === "ocr-processing" && (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.progressText}>
              识别中 {progress.current}/{progress.total}...
            </Text>
          </View>
        )}

        {step === "edit-chapters" && (
          <View>
            <Text style={styles.label}>章节列表（点击编辑）</Text>
            {chapters.map((ch, i) => (
              <TouchableOpacity
                key={ch.id}
                style={styles.chapterRow}
                onPress={() => setEditingIndex(i)}
              >
                <Text style={styles.chapterTitle}>{ch.title}</Text>
                <Text style={styles.chapterPreview} numberOfLines={1}>
                  {ch.text || "（识别为空，点击编辑）"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === "name-book" && (
          <View>
            <Text style={styles.label}>书名</Text>
            <TextInput
              style={styles.input}
              value={bookTitle}
              onChangeText={setBookTitle}
              placeholder="输入书名"
              placeholderTextColor={COLORS.secondaryText}
            />
          </View>
        )}

        {step === "tts-generating" && (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.progressText}>
              合成语音 {progress.current}/{progress.total}...
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step === "select-images" && (
          <TouchableOpacity
            onPress={runOcr}
            disabled={images.length === 0}
            style={[styles.primaryBtn, images.length === 0 && styles.primaryBtnDisabled]}
          >
            <Text style={styles.primaryBtnText}>开始识别</Text>
          </TouchableOpacity>
        )}
        {step === "edit-chapters" && (
          <TouchableOpacity onPress={() => setStep("name-book")} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>下一步</Text>
          </TouchableOpacity>
        )}
        {step === "name-book" && (
          <View style={styles.btnRow}>
            <TouchableOpacity onPress={() => setStep("edit-chapters")} style={styles.outlineBtn}>
              <Text style={styles.outlineBtnText}>上一步</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={runTts} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>完成并生成语音</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
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
    color: COLORS.accent,
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
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  label: {
    color: COLORS.secondaryText,
    fontSize: 14,
    marginBottom: 12,
    marginTop: 8,
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
  },
  outlineBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.accent,
    flex: 1,
    alignItems: "center",
  },
  outlineBtnText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: "600",
  },
  thumbRow: {
    marginTop: 16,
    flexDirection: "row",
  },
  thumbWrap: {
    marginRight: 8,
    position: "relative",
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#333",
  },
  thumbRemove: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbRemoveText: {
    color: COLORS.primaryText,
    fontSize: 14,
    fontWeight: "700",
  },
  hint: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 12,
  },
  centerBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  progressText: {
    color: COLORS.primaryText,
    fontSize: 16,
    marginTop: 16,
  },
  chapterRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ffffff10",
  },
  chapterTitle: {
    color: COLORS.primaryText,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  chapterPreview: {
    color: COLORS.secondaryText,
    fontSize: 13,
  },
  input: {
    color: COLORS.primaryText,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ffffff20",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
    flex: 1,
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default OcrImportScreen;
