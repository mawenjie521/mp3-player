# TXT 整本小说导入 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户选一个 `.txt` 文件，应用按章节标题正则自动分章，用户调整标题/正文/合并/拆分后，逐章 TTS 合成 `.m4a`，作为一本 OCR 风格的书加入小说 tab。

**Architecture:** 新建 `TxtImportScreen` 向导（选文件 -> 解析 -> 编辑列表 -> 命名 -> TTS -> 完成）和 `txtChapterParser` 纯函数模块。复用现有 `synthesizeChapter(text, outputPath)`（已支持显式路径）、`ocrNovels.js` 存储布局、`OcrChapterEditScreen` 正文编辑器（新增可选 `onSplitHere` prop 支持光标处拆分）。与 OCR/文件夹/空小说三种导入并列，在 `onAdd` Alert 加第三项入口。

**Tech Stack:** React Native 0.75.4, react-native-document-picker, react-native-fs, AsyncStorage, react-native-track-player, iOS AVSpeechSynthesizer (via TTSWriter native module)。

## Global Constraints

- 无自动化测试套件（项目惯例）。每个任务的自动验证门是 **Metro bundle 构建**：`npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`。不要跑 `npm test`（会因「No tests found」退出 1，属预期）。
- 手动验证由用户在 iOS 模拟器进行，每个任务给出验证清单。
- 仅 iOS。仅 UTF-8（GBK 文件提示用户转换，不自动解码）。
- 代码风格跟随现有文件：无分号、双引号、ES2020+ 语法。
- 现有 OCR 小说不迁移、不改数据；TXT 导入的书复用 OCR 书元数据结构（`isOCR: true`、`bookId`、`chapters[]`、`bookDir`），不新增字段。
- bookId 仍是 `ocr-${Date.now()}`。
- 路径以 `file://` 协议存储，`resolvePath` 按 `/Documents/` 标记重新锚定以跨重装。
- **Spec 与当前代码的差异说明**：spec 提到要给 `tts.js` 新增 `synthesizeToPath` 并迁移 `OcrImportScreen.runTts`。实际当前代码 `tts.js` 的 `synthesizeChapter(text, outputPath)` 已经接受显式路径参数（`src/data/tts.js:5`），`OcrImportScreen` 也已经传路径（`src/screens/OcrImportScreen.js:255`）。**这两个改动是 no-op，本计划不涉及**。

## Spec 对照

| Spec 章节 | 对应 Task |
|-----------|-----------|
| 新增文件 `txtChapterParser.js`（detectChapters / detectBookName / sanitizeChapterFilename / looksLikeGbkDecodedAsUtf8） | Task 1 |
| `OcrChapterEditScreen` 新增 `onSplitHere` prop + 光标追踪 | Task 2 |
| 新增文件 `TxtImportScreen.js`（向导主控） | Task 3 |
| App.js 接线（Alert 第三项 / view 新分支 / onComplete 回调） | Task 4 |
| 数据模型 / 文件系统布局 / 队列构造 / 删除 / MineScreen 展示 | 无需改动（复用现有 `expandOCRChapters` / `getBookDir` / `deleteOCRNovel` / `checkOCRFileExistence`） |

---

## File Structure

| 文件 | 职责 | 本次改动 |
|------|------|----------|
| `src/data/txtChapterParser.js` | 章节识别 / 书名识别 / 文件名 sanitize / GBK 启发式检测 | 新文件 |
| `src/screens/OcrChapterEditScreen.js` | 章节正文编辑器 | 新增可选 `onSplitHere` prop + `onSelectionChange` 光标追踪 + 条件渲染「在光标处拆分」按钮 |
| `src/screens/TxtImportScreen.js` | TXT 整本导入向导主控 | 新文件 |
| `App.js` | 顶层状态与接线 | `onAdd` Alert 加第三项；新增 `onStartTxtImport` / `onTxtImportComplete`；`view === "txt-import"` 渲染分支 |

---

### Task 1: 新建 `txtChapterParser.js` 纯函数模块

**Files:**
- Create: `src/data/txtChapterParser.js`

**Interfaces:**
- Produces:
  - `detectChapters(text: string): Array<{title: string, body: string}>` - 按章节标题正则分章，0 章兜底整本 1 章，空正文章节自动剔除
  - `detectBookName(filename: string): string` - 从文件名去路径去扩展名，空回退「未命名小说」
  - `sanitizeChapterFilename(title: string, index: number): string` - 替换非法字符为 `_`，折叠空白，截断 60 字，空回退 `第 N 章`
  - `looksLikeGbkDecodedAsUtf8(text: string): boolean` - U+FFFD 占比 > 1% 判定为 GBK 误读
- Consumes: 无（纯函数模块，无外部依赖）

- [ ] **Step 1: 创建 `src/data/txtChapterParser.js`**

```js
const CHAPTER_RE = /^\s*第\s*([零一二三四五六七八九十百千0-9]+)\s*([章回节])\s*(.*)$/;

export function detectChapters(text) {
  const lines = text.split("\n");
  const raw = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(CHAPTER_RE);
    if (m) {
      if (current) raw.push(current);
      current = {
        title: m[0].trim(),
        body: "",
      };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current) raw.push(current);

  const chapters = raw.filter((ch) => ch.body.trim().length > 0);

  if (chapters.length === 0) {
    return [{ title: "第 1 章", body: text.trim() }];
  }

  return chapters.map((ch) => ({ ...ch, body: ch.body.trim() }));
}

export function detectBookName(filename) {
  const base = filename.replace(/^.*[\\/]/, "");
  const noExt = base.replace(/\.[^.]+$/, "");
  const trimmed = noExt.trim();
  return trimmed || "未命名小说";
}

export function sanitizeChapterFilename(title, index) {
  const cleaned = (title || "")
    .trim()
    .replace(/[/:\x00\n\t\r]/g, "_")
    .replace(/\s+/g, " ");
  if (!cleaned) return `第 ${index + 1} 章`;
  return cleaned.length > 60 ? cleaned.substring(0, 60) : cleaned;
}

export function looksLikeGbkDecodedAsUtf8(text) {
  const replacementCount = (text.match(/�/g) || []).length;
  return replacementCount > text.length * 0.01;
}
```

- [ ] **Step 2: Metro bundle 验证**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: 构建成功，无「Unable to resolve module」错误。

- [ ] **Step 3: Commit**

```bash
git add src/data/txtChapterParser.js
git commit -m "feat(txt-import): add chapter parser module

- detectChapters: split by 第N章/回/节 regex, drop empty-body chapters, fallback to whole-text-as-one
- detectBookName: strip path and extension from filename
- sanitizeChapterFilename: replace illegal chars, fold whitespace, truncate to 60 chars
- looksLikeGbkDecodedAsUtf8: >1% U+FFFD replacement chars => likely GBK"
```

**手动验证清单（用户在模拟器）：** 本任务只新增纯函数模块，无 UI 变化。Metro bundle 通过即可。函数行为在 Task 3 集成时端到端验证。

---

### Task 2: `OcrChapterEditScreen` 新增 `onSplitHere` prop

**Files:**
- Modify: `src/screens/OcrChapterEditScreen.js`

**Interfaces:**
- Produces: `OcrChapterEditScreen` 接受可选 prop `onSplitHere: (text: string, cursorPos: number) => void`。传入时底部按钮行变为「保存」+「在光标处拆分」两个按钮；不传时行为不变（仅「保存」）。
- Consumes: 无（向后兼容，OCR 流程不传 `onSplitHere`，行为不变）。

- [ ] **Step 1: 修改 `src/screens/OcrChapterEditScreen.js`**

将整个文件替换为以下内容：

```jsx
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView } from "react-native";
import { COLORS } from "../data/constants";

function OcrChapterEditScreen({ chapterTitle, initialText, onSave, onBack, onSplitHere }) {
  const [text, setText] = useState(initialText);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{chapterTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TextInput
          style={styles.editor}
          value={text}
          onChangeText={setText}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          multiline
          textAlignVertical="top"
          autoFocus
          placeholder="（识别为空，请手动输入）"
          placeholderTextColor={COLORS.secondaryText}
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity
            onPress={() => onSave(text)}
            style={styles.saveBtn}
          >
            <Text style={styles.saveBtnText}>保存</Text>
          </TouchableOpacity>
          {onSplitHere && (
            <TouchableOpacity
              onPress={() => onSplitHere(text, selection.start)}
              style={[styles.saveBtn, styles.splitBtn]}
            >
              <Text style={styles.saveBtnText}>在光标处拆分</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
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
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  editor: {
    flex: 1,
    color: COLORS.primaryText,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: "top",
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: "row",
  },
  saveBtn: {
    flex: 1,
    backgroundColor: COLORS.accentNovel,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
  },
  splitBtn: {
    marginLeft: 12,
    backgroundColor: COLORS.secondaryText,
  },
  saveBtnText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default OcrChapterEditScreen;
```

- [ ] **Step 2: Metro bundle 验证**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: 构建成功。

- [ ] **Step 3: Commit**

```bash
git add src/screens/OcrChapterEditScreen.js
git commit -m "feat(chapter-edit): add optional onSplitHere prop for cursor-position split

When onSplitHere is passed, bottom button row shows '保存' + '在光标处拆分'.
Tracks cursor via onSelectionChange. OCR flow unchanged (doesn't pass
onSplitHere, single '保存' button remains)."
```

**手动验证清单：**
- 进入 OCR 导入流程（小说 tab + -> 导入文件创建 -> 选图），到 edit-chapters 步点「编辑」进入 OcrChapterEditScreen
- 底部应只有一个「保存」按钮（OCR 流程未传 `onSplitHere`，行为不变）
- 保存生效，回到章节列表

---

### Task 3: 新建 `TxtImportScreen.js` 向导主控

**Files:**
- Create: `src/screens/TxtImportScreen.js`

**Interfaces:**
- Produces: `TxtImportScreen` 默认导出，接受 props `{ onComplete: (book: Object) => void, onCancel: () => void }`。`onComplete` 在 TTS 全部完成且书对象组装好后调用，传入完整 book 对象（含 `id` / `title` / `coverImage: ""` / `chapters[]` / `createdAt` / `isOCR: true` / `bookDir`）。
- Consumes:
  - `src/data/txtChapterParser.js`（Task 1）的 `detectChapters` / `detectBookName` / `sanitizeChapterFilename` / `looksLikeGbkDecodedAsUtf8`
  - `src/data/tts.js` 的 `synthesizeChapter(text, outputPath)`（现有，已支持显式路径）
  - `src/data/ocrNovels.js` 的 `computeBookDir(title, bookId)`（现有导出）
  - `src/screens/OcrChapterEditScreen.js`（Task 2 后）的 `onSplitHere` prop

- [ ] **Step 1: 创建 `src/screens/TxtImportScreen.js`**

```jsx
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
      setChapters(detected);
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
    backgroundColor: COLORS.card || COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border || "#e0e0e0",
  },
  titleInput: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: "600",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border || "#e0e0e0",
  },
  bookTitleInput: {
    color: COLORS.primaryText,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.card || COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border || "#e0e0e0",
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
    backgroundColor: COLORS.border || "#e0e0e0",
  },
  smallBtnText: {
    color: COLORS.primaryText,
    fontSize: 13,
  },
  progressBar: {
    width: "80%",
    height: 8,
    backgroundColor: COLORS.border || "#e0e0e0",
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
```

- [ ] **Step 2: 确认 `COLORS` 调色板字段**

Run: `grep -n "card\|border\|accentNovel\|primaryText\|secondaryText\|background" src/data/constants.js`
Expected: 列出 `COLORS` 对象的所有字段。若 `card` 或 `border` 不存在，Step 1 中的 `COLORS.card || COLORS.background` 和 `COLORS.border || "#e0e0e0"` 回退会生效（使用 `background` 和硬编码灰色）。若想用项目主色调，根据 grep 结果把 `#e0e0e0` 替换为项目实际的边框色。

- [ ] **Step 3: Metro bundle 验证**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: 构建成功。若报「Unable to resolve module txtChapterParser」，确认 Task 1 已完成。若报 `COLORS.xxx is undefined`，按 Step 2 结果修正。

- [ ] **Step 4: Commit**

```bash
git add src/screens/TxtImportScreen.js
git commit -m "feat(txt-import): add TxtImportScreen wizard

Steps: pick-file -> parsing -> edit-chapters -> name-book -> tts-generating.
Edit step supports inline title edit, delete, merge-with-next, split-at-cursor
(via OcrChapterEditScreen.onSplitHere). Reuses synthesizeChapter, computeBookDir,
and OCR book metadata shape. Finalizes by moving temp folder to titled folder."
```

**手动验证清单（用户在模拟器，Task 4 接线后才能完整跑）：**
- 准备一个 UTF-8 编码的中文 TXT 小说文件（含「第一章 ...」「第二章 ...」等章节标记）
- 进入 TxtImportScreen（Task 4 接线后从小说 tab + -> 导入 TXT 整本进入）
- 选 TXT 文件 -> 自动解析 -> 章节列表正确显示标题和正文预览
- 改某章标题 -> 输入框更新
- 点「编辑正文」-> 进入 OcrChapterEditScreen，底部有「保存」+「在光标处拆分」两个按钮
- 把光标放在段落中间 -> 点「在光标处拆分」-> 回到列表，当前章截断，下一章为新章
- 把光标放在文本最末 -> 点「在光标处拆分」-> 弹「拆分位置无效」Alert
- 点「合并↓」-> 当前章文本拼接下一章，下一章消失
- 点「✕」-> Alert 二次确认 -> 删除
- 「下一步」-> 命名步，书名默认填文件名
- 「开始合成语音」-> 进度条推进 -> 完成后 `onComplete` 被调用（Task 4 接线后回到小说 tab）

---

### Task 4: App.js 接线

**Files:**
- Modify: `App.js`

**Interfaces:**
- Produces: `view === "txt-import"` 渲染分支；`onAdd` Alert 第三项「导入 TXT 整本」；`onTxtImportComplete(book)` 处理器（存 AsyncStorage + 刷新 state + 切回 tabs）。
- Consumes: `TxtImportScreen`（Task 3）的 `onComplete(book)` / `onCancel()`；`ocrNovels.js` 的 `saveOCRNovel(book)`（现有导出）。

- [ ] **Step 1: 在 `App.js` 找到 `onStartImport` 和 `onAdd`**

Run: `grep -n "onStartImport\|onAdd\b\|onCreateEmptyBook\|showCreateEmptyBook" App.js`
Expected: 输出 `onStartImport` 定义行号、`onAdd` 定义行号（约 475-490）、`showCreateEmptyBook` state 行号（约 59）。

- [ ] **Step 2: 新增 `onStartTxtImport` 和 `onTxtImportComplete` 函数**

在 `App.js` 中 `onStartImport` 函数定义**之后**、`onAdd` 函数定义**之前**插入：

```js
const onStartTxtImport = () => {
  setView("txt-import");
};

const onTxtImportComplete = async (book) => {
  const next = await saveOCRNovel(book);
  setOcrNovels(next);
  setView("tabs");
  setTab("novels");
};
```

> 注：`saveOCRNovel` 和 `setOcrNovels` 已在文件中导入/定义（OCR 流程在用）。若 `saveOCRNovel` 未导入，在文件顶部 `import { ... } from "./src/data/ocrNovels"` 处补上。

- [ ] **Step 3: `onAdd` Alert 加第三项**

找到 `onAdd` 函数（约 480 行），把 Alert 改为：

```js
const onAdd = () => {
  Alert.alert("添加小说", null, [
    { text: "导入文件创建", onPress: onStartImport },
    { text: "导入 TXT 整本", onPress: onStartTxtImport },
    { text: "创建空小说", onPress: () => setShowCreateEmptyBook(true) },
  ]);
};
```

> 顺序说明：「导入文件创建」和「创建空小说」是现有项，位置不变；「导入 TXT 整本」插在中间。

- [ ] **Step 4: 新增 `view === "txt-import"` 渲染分支**

找到现有 `view === "ocr-import"` 渲染分支（Run: `grep -n 'view === "ocr-import"' App.js`），在其**之后**插入：

```jsx
{view === "txt-import" && (
  <TxtImportScreen
    onComplete={onTxtImportComplete}
    onCancel={() => setView("tabs")}
  />
)}
```

- [ ] **Step 5: 在 `App.js` 顶部导入 `TxtImportScreen`**

找到现有 `import OcrImportScreen from ...` 行（Run: `grep -n "import OcrImportScreen" App.js`），在其**之后**加：

```js
import TxtImportScreen from "./src/screens/TxtImportScreen";
```

- [ ] **Step 6: Metro bundle 验证**

Run: `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js`
Expected: 构建成功。若报「TxtImportScreen is not defined」，确认 Step 5 导入已加。若报「saveOCRNovel is not defined」，确认 `saveOCRNovel` 已从 `ocrNovels.js` 导入（Run: `grep -n "saveOCRNovel" App.js`，若无则在 OCR 导入语句处补上）。

- [ ] **Step 7: Commit**

```bash
git add App.js
git commit -m "feat(txt-import): wire TxtImportScreen into App.js

- onAdd Alert adds third option '导入 TXT 整本'
- New view 'txt-import' renders TxtImportScreen
- onTxtImportComplete saves book via saveOCRNovel, refreshes ocrNovels state,
  returns to novels tab"
```

**手动验证清单（用户在模拟器，全流程端到端）：**
1. 小说 tab 顶部点「+」-> Alert 显示三个选项：「导入文件创建」/「导入 TXT 整本」/「创建空小说」
2. 点「导入 TXT 整本」-> 进入 TxtImportScreen，显示「选择 TXT 文件」按钮
3. 点按钮 -> 系统文件选择器 -> 选一个 UTF-8 中文 TXT -> 自动解析 -> 章节列表显示
4. 验证 Task 3 的所有编辑操作（改标题 / 编辑正文 / 拆分 / 合并 / 删除）
5. 「下一步」-> 命名步 -> 书名默认填文件名 -> 「开始合成语音」
6. 进度条推进 -> 完成后自动回到小说 tab
7. 小说 tab 出现新书，带 OCR 徽章，按 bookId 限定队列（点章节播放，下一首在同书内推进）
8. 「我的」-> OCR 小说 子 tab -> 新书可见，显示章节数
9. 长按新书 -> 「删除」-> 书和文件夹移除
10. 边界测试：
    - 选 GBK 编码的 TXT -> Alert「编码不支持」-> 留在选文件步
    - 选无章节标记的 TXT -> 整本作为 1 章
    - 选含目录页的 TXT（开头多个「第一章」但无正文）-> 目录项自动剔除
    - 选空 TXT 文件 -> 1 章空正文 -> TTS 跳过 -> 「合成失败」Alert
    - 中途按「‹ 返回」-> Alert「放弃本次导入？」-> 确认后回小说 tab，临时文件夹清理

---

## Self-Review

### 1. Spec coverage

| Spec 章节 | 覆盖任务 |
|-----------|----------|
| 入口（onAdd Alert 第三项） | Task 4 Step 3 |
| 新增文件 TxtImportScreen / txtChapterParser | Task 1, Task 3 |
| 复用 synthesizeChapter / computeBookDir / OcrChapterEditScreen | Task 3（直接调用，无需改造 tts.js 和 ocrNovels.js） |
| 数据流（选文件 -> 解析 -> 编辑 -> 命名 -> TTS -> 完成） | Task 3 完整实现 |
| 数据模型（复用 OCR 书结构，不新增字段） | Task 3 runTts 组装 book 对象 |
| 文件系统布局（temp 文件夹 + moveFile 最终化） | Task 3 runTts |
| 章节识别正则 | Task 1 detectChapters |
| 0 章兜底 / 空正文剔除 | Task 1 detectChapters |
| 书名识别（文件名优先） | Task 1 detectBookName |
| 向导状态机 | Task 3 step state |
| edit-chapters UI（内联标题 / 编辑正文 / 合并 / 拆分 / 删除） | Task 3 render + onSplitHere in Task 2 |
| name-book UI（预填文件名 + 章节多提示） | Task 3 render |
| tts-generating UI（进度条） | Task 3 render |
| 取消/返回（cleanupAndCancel） | Task 3 |
| TTS 错误处理（重试/跳过/取消） | Task 3 runTts |
| GBK 检测 | Task 1 looksLikeGbkDecodedAsUtf8 + Task 3 parseFile |
| moveFile 失败兜底 | Task 3 runTts (finalDir = bookDir fallback) |
| 章节文件名 sanitize | Task 1 sanitizeChapterFilename + Task 3 runTts |
| App.js 接线 | Task 4 |
| NovelsScreen / MineScreen 零改动 | 无需任务（复用 expandOCRChapters） |

### 2. Placeholder scan

- 无 TBD / TODO / "implement later"
- 所有代码步骤都给了完整代码
- 验证命令都给了 exact 命令和 expected 输出
- Task 4 Step 2 的 `saveOCRNovel` 导入检查给了 grep 命令兜底

### 3. Type consistency

- `detectChapters(text) -> Array<{title, body}>`：Task 1 定义，Task 3 `parseFile` 调用并 `setChapters(detected)`，后续 `chapters[i].title` / `chapters[i].text` 访问一致
- `onSplitHere(text, cursorPos)`：Task 2 OcrChapterEditScreen 调用 `onSplitHere(text, selection.start)`，Task 3 定义 `onSplitHere = (fullText, cursorPos) => {...}`，签名一致
- `onComplete(book)`：Task 3 `runTts` 末尾 `onComplete(book)`，Task 4 `onTxtImportComplete = async (book) => {...}`，签名一致
- `book` 对象字段：Task 3 组装 `{id, title, coverImage, chapters, createdAt, isOCR, bookDir}`，与 OCR 书结构一致（`expandOCRChapters` 读取 `book.id` / `book.title` / `book.coverImage` / `book.chapters` / `book.bookDir`）
- `chapters[i]` 字段：Task 3 拆分时插入 `{id, title, text, sourceImagePath, audioPath, ocrFailed}`，与 `expandOCRChapters` 读取的 `ch.id` / `ch.audioPath` / `ch.ttsFailed` 一致（`ttsFailed` 由 `checkOCRFileExistence` 启动时设置，新建书初始无此字段，不影响）

### 4. Spec 与代码差异已说明

Global Constraints 中明确说明：spec 提到的 `tts.js` 新增 `synthesizeToPath` 和 `OcrImportScreen` 迁移是 no-op（当前代码 `synthesizeChapter(text, outputPath)` 已支持显式路径），本计划不涉及。这简化了实现，减少了 2 个不必要的任务。
