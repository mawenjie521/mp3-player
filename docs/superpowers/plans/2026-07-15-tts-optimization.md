# TTS 音质优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户能选择并使用设备上已有的最佳中文系统语音（premium > enhanced > compact），暴露语速调节，持久化偏好，并在未下载 premium 语音包时主动引导。

**Architecture:** 原生模块 `TTSWriter.mm` 改用 `AVVoiceQuality` 枚举判定语音质量并新增 `previewVoice` 试听方法；JS 层 `tts.js` 增加 AsyncStorage 持久化和自动加载；新增 `TTSSettingsScreen` 供用户选择语音/语速；通过现有 `SettingsScreen` 入口接入。

**Tech Stack:** React Native 0.75.4, Objective-C++ (AVSpeechSynthesizer), AsyncStorage, @react-native-community/slider, iOS 15.5+。

## Global Constraints

- **No automated tests** - 本项目无测试套件。验证门是 Metro bundle build + 用户手动 iOS 模拟器检查。不要运行 `npm test`（它以 "No tests found" 退出 1，是既有状态，非本次回归）。
- **Verification gate:** `npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js` 必须以 0 退出，输出以 `info Done writing bundle output` 结尾。
- **Native 改动需 Xcode 重建** - Metro bundle 不编译原生代码。原生任务（Task 1、2）的 native 改动需用户在 Xcode 中重建 app 才能实际生效；Claude 的自动验证门仍是 Metro bundle（确认 JS 接口未破坏）。
- **eslint 未配置** - 不要添加 lint 步骤。
- **Commit style:** 首字母大写的动词开头（如 "Refactor TTS voice selection to use quality enum"），带 `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer。用 HEREDOC 传递 commit message。
- **iOS only** - 仅 iOS，Android 不在范围内。原生代码用 Objective-C++（`.mm`），与现有 `TTSWriter.mm` 模式一致。
- **COLORS 常量** - 红色主色是 `COLORS.accent`（#C20C0C），不是 `COLORS.primary`。可用值见 `src/data/constants.js`。
- **App.js 当前 757 行** - 本期新增约 +15 行，不做拆分。

---

## Task 1: 原生模块 - voice 质量判定改用 AVVoiceQuality 枚举

将 `TTSWriter.mm` 中 `selectVoice` 和 `getVoices` 的字符串匹配（`containsString:@"premium"`）替换为 `AVSpeechSynthesisVoice.quality` 枚举判定，更健壮地适配新版 iOS voice identifier 变化。同时让 `getVoices` 按 quality 降序排序并增加 `downloaded` 字段。

**Files:**
- Modify: `ios/MP3Player/TTSWriter.mm`（`selectVoice` 函数 36-82 行；`getVoices` 方法 218-237 行）

**Interfaces:**
- Consumes: 无（第一个任务）
- Produces: `getVoices()` 返回值结构变化 -- 新增 `downloaded: true` 字段，按 quality 降序排序。`quality` 字段仍为字符串 `"premium"`/`"enhanced"`/`"compact"`/`"default"`，向后兼容。`selectVoice` 行为不变（仍按 premium > enhanced > compact 降序选第一个），仅实现方式改用枚举。

- [ ] **Step 1: 替换 `selectVoice` 函数**

在 `ios/MP3Player/TTSWriter.mm` 中，将 36-82 行的整个 `selectVoice` 函数替换为：

```objc
static AVSpeechSynthesisVoice *selectVoice(NSString *voiceId) {
  if (voiceId.length > 0) {
    AVSpeechSynthesisVoice *v = [AVSpeechSynthesisVoice voiceWithIdentifier:voiceId];
    if (v) {
      TTSLog(@"using voice by identifier: %@ (%@)", voiceId, v.name);
      return v;
    }
  }

  NSArray<AVSpeechSynthesisVoice *> *allVoices = [AVSpeechSynthesisVoice speechVoices];
  NSMutableArray<AVSpeechSynthesisVoice *> *zhVoices = [NSMutableArray array];
  for (AVSpeechSynthesisVoice *v in allVoices) {
    if ([v.language hasPrefix:@"zh"]) {
      [zhVoices addObject:v];
    }
  }

  NSArray<AVSpeechSynthesisVoice *> *sorted = [zhVoices sortedArrayUsingComparator:^NSComparisonResult(AVSpeechSynthesisVoice *a, AVSpeechSynthesisVoice *b) {
    if (a.quality > b.quality) return NSOrderedAscending;
    if (a.quality < b.quality) return NSOrderedDescending;
    return NSOrderedSame;
  }];

  if (sorted.count > 0) {
    AVSpeechSynthesisVoice *best = sorted[0];
    TTSLog(@"selected best voice: %@ (id=%@, quality=%ld)", best.name, best.identifier, (long)best.quality);
    return best;
  }

  AVSpeechSynthesisVoice *fallback = [AVSpeechSynthesisVoice voiceWithLanguage:@"zh-CN"];
  TTSLog(@"fallback voice: %@ (id=%@)", fallback.name, fallback.identifier);
  return fallback;
}
```

- [ ] **Step 2: 替换 `getVoices` 方法**

将 218-237 行的整个 `getVoices` 方法替换为：

```objc
RCT_EXPORT_METHOD(getVoices:(RCTPromiseResolveBlock)resolve
                       rejecter:(RCTPromiseRejectBlock)reject)
{
  NSArray<AVSpeechSynthesisVoice *> *voices = [AVSpeechSynthesisVoice speechVoices];
  NSMutableArray<NSMutableDictionary *> *zhVoices = [NSMutableArray array];

  for (AVSpeechSynthesisVoice *v in voices) {
    if (![v.language hasPrefix:@"zh"]) continue;

    NSString *qualityStr;
    switch (v.quality) {
      case AVVoiceQualityPremium: qualityStr = @"premium"; break;
      case AVVoiceQualityEnhanced: qualityStr = @"enhanced"; break;
      case AVVoiceQualityCompact:  qualityStr = @"compact"; break;
      default:                     qualityStr = @"default"; break;
    }

    [zhVoices addObject:[NSMutableDictionary dictionaryWithDictionary:@{
      @"identifier": v.identifier ?: @"",
      @"name": v.name ?: @"",
      @"language": v.language ?: @"",
      @"quality": qualityStr,
      @"_qv": @(v.quality),
      @"downloaded": @YES,
    }]];
  }

  [zhVoices sortUsingComparator:^NSComparisonResult(NSDictionary *a, NSDictionary *b) {
    NSInteger qa = [a[@"_qv"] integerValue];
    NSInteger qb = [b[@"_qv"] integerValue];
    if (qa > qb) return NSOrderedAscending;
    if (qa < qb) return NSOrderedDescending;
    return NSOrderedSame;
  }];

  NSMutableArray *result = [NSMutableArray array];
  for (NSMutableDictionary *d in zhVoices) {
    [d removeObjectForKey:@"_qv"];
    [result addObject:d];
  }

  TTSLog(@"getVoices: returning %lu zh voices (sorted by quality desc)", (unsigned long)result.count);
  resolve(result);
}
```

- [ ] **Step 3: 验证 Metro bundle 通过**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: 以 0 退出，输出以 `info Done writing bundle output` 结尾。（此门只确认 JS 接口未破坏；原生改动需用户在 Xcode 重建才能编译验证。）

- [ ] **Step 4: Commit**

```bash
git add ios/MP3Player/TTSWriter.mm
git commit -m "$(cat <<'EOF'
Refactor TTS voice selection to use AVVoiceQuality enum

Replace string-matching on voice identifiers with the AVVoiceQuality
enum for robustness across iOS versions. getVoices now sorts by quality
descending and includes a downloaded flag.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 原生模块 - 新增 previewVoice 试听方法

新增 `previewVoice(voiceId, rate, text)` 方法，用 `AVSpeechSynthesizer speak:` 直接朗读（不写文件），用于设置页试听。native 层持有 `previewSynth` 单例，调用时先 stop 上一个 utterance，避免重叠。同时抽出 `rateToAVRate` 辅助函数消除 `synthesize` 中的重复 rate 逻辑。

**Files:**
- Modify: `ios/MP3Player/TTSWriter.mm`（新增 `rateToAVRate` 静态函数、`@interface` 扩展、`previewVoice` 方法；重构 `synthesize` 的 rate 计算段）

**Interfaces:**
- Consumes: Task 1 的 `selectVoice`
- Produces: `TTSWriter.previewVoice(voiceId: string, rate: number, text: string) -> Promise<{success: true}>`，供 Task 3 的 JS 封装调用

- [ ] **Step 1: 新增 `rateToAVRate` 静态辅助函数**

在 `ios/MP3Player/TTSWriter.mm` 中，`selectVoice` 函数之后（`@implementation TTSWriter` 之前）插入：

```objc
static float rateToAVRate(float rateF) {
  if (rateF == 0) {
    return AVSpeechUtteranceDefaultSpeechRate;
  } else if (rateF > 0) {
    return AVSpeechUtteranceDefaultSpeechRate +
      rateF * (AVSpeechUtteranceMaximumSpeechRate - AVSpeechUtteranceDefaultSpeechRate) / 100.0;
  } else {
    return AVSpeechUtteranceMinimumSpeechRate +
      (-rateF) * (AVSpeechUtteranceDefaultSpeechRate - AVSpeechUtteranceMinimumSpeechRate) / 100.0;
  }
}
```

- [ ] **Step 2: 新增 `@interface` 扩展持有 previewSynth**

在 `@implementation TTSWriter` 之前插入：

```objc
@interface TTSWriter ()
@property (nonatomic, strong) AVSpeechSynthesizer *previewSynth;
@end
```

- [ ] **Step 3: 重构 `synthesize` 中的 rate 计算**

在 `synthesize` 方法中，将这段（约 106-115 行）：

```objc
    float rateF = [rateVal floatValue];
    if (rateF == 0) {
      utterance.rate = AVSpeechUtteranceDefaultSpeechRate;
    } else if (rateF > 0) {
      utterance.rate = AVSpeechUtteranceDefaultSpeechRate +
        rateF * (AVSpeechUtteranceMaximumSpeechRate - AVSpeechUtteranceDefaultSpeechRate) / 100.0;
    } else {
      utterance.rate = AVSpeechUtteranceMinimumSpeechRate +
        (-rateF) * (AVSpeechUtteranceDefaultSpeechRate - AVSpeechUtteranceMinimumSpeechRate) / 100.0;
    }
```

替换为：

```objc
    float rateF = [rateVal floatValue];
    utterance.rate = rateToAVRate(rateF);
```

- [ ] **Step 4: 新增 `previewVoice` 方法**

在 `@implementation TTSWriter` 中，`getVoices` 方法之前（`synthesize` 方法之后）插入：

```objc
RCT_EXPORT_METHOD(previewVoice:(NSString *)voiceId
                           rate:(nonnull NSNumber *)rateVal
                           text:(NSString *)text
                      resolver:(RCTPromiseResolveBlock)resolve
                      rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (!self.previewSynth) {
      self.previewSynth = [[AVSpeechSynthesizer alloc] init];
    }
    [self.previewSynth stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];

    AVSpeechUtterance *utterance = [[AVSpeechUtterance alloc] initWithString:text.length > 0 ? text : @""];
    utterance.voice = selectVoice(voiceId);
    utterance.rate = rateToAVRate([rateVal floatValue]);

    TTSLog(@"previewVoice: voice=%@ (id=%@), rate=%.1f->%.2f, text=%lu chars",
           utterance.voice.name, utterance.voice.identifier,
           [rateVal floatValue], utterance.rate, (unsigned long)utterance.speechString.length);

    [self.previewSynth speak:utterance];
    resolve(@{ @"success": @YES });
  });
}
```

- [ ] **Step 5: 验证 Metro bundle 通过**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: 以 0 退出，输出以 `info Done writing bundle output` 结尾。

- [ ] **Step 6: Commit**

```bash
git add ios/MP3Player/TTSWriter.mm
git commit -m "$(cat <<'EOF'
Add previewVoice method to TTSWriter for audition

Speak via AVSpeechSynthesizer without writing to file. Holds a
singleton synthesizer that stops the previous utterance before
speaking the next, preventing overlap on rapid taps. Extracts
rateToAVRate helper to DRY the rate computation with synthesize.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: JS 层 - TTS 设置持久化 + previewVoice 封装 + synthesizeChapter 自动加载

扩展 `src/data/tts.js`：新增 `loadTTSSettings` / `saveTTSSettings` / `previewVoice`；`synthesizeChapter` 在调用方未传 voice/rate 时自动从 AsyncStorage 读取用户偏好。调用方（`OcrImportScreen` / `TxtImportScreen`）零改动。

**Files:**
- Modify: `src/data/tts.js`（当前 31 行，扩展到约 75 行）

**Interfaces:**
- Consumes: Task 2 的 `TTSWriter.previewVoice` native 方法
- Produces:
  - `loadTTSSettings() -> Promise<{voice: string, rate: number}>`
  - `saveTTSSettings(voice: string, rate: number) -> Promise<{voice, rate, updatedAt}>`
  - `previewVoice(voiceId: string, rate: number, text: string) -> Promise<{success: true}>`
  - `synthesizeChapter(text, outputPath, voice?, rate?)` -- voice/rate 现在可选且默认从 AsyncStorage 读取

- [ ] **Step 1: 重写 `src/data/tts.js`**

将 `src/data/tts.js` 全文替换为：

```js
import { NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { TTSWriter } = NativeModules;

const DEFAULT_VOICE = "";
const DEFAULT_RATE = 0;
const AUDIO_EXT = "m4a";
const TTS_SETTINGS_KEY = "@mp3player:tts-settings";
const RATE_MIN = -50;
const RATE_MAX = 50;

export async function synthesizeChapter(text, outputPath, voice, rate) {
  if (!TTSWriter) {
    throw new Error("TTSWriter native module not available");
  }
  let effectiveVoice = voice;
  let effectiveRate = rate;
  if (effectiveVoice == null || effectiveRate == null) {
    const settings = await loadTTSSettings();
    if (effectiveVoice == null) effectiveVoice = settings.voice;
    if (effectiveRate == null) effectiveRate = settings.rate;
  }
  const result = await TTSWriter.synthesize(text, outputPath, effectiveVoice, effectiveRate);
  return result.path;
}

export async function getVoices() {
  if (!TTSWriter) {
    return [];
  }
  return TTSWriter.getVoices();
}

export async function previewVoice(voiceId, rate, text) {
  if (!TTSWriter) {
    throw new Error("TTSWriter native module not available");
  }
  const effectiveText = text && text.length > 0 ? text : "这是一段试听文本，用于预览语音效果。";
  return TTSWriter.previewVoice(voiceId || "", rate != null ? rate : 0, effectiveText);
}

export async function loadTTSSettings() {
  try {
    const raw = await AsyncStorage.getItem(TTS_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        voice: parsed.voice || "",
        rate: typeof parsed.rate === "number" ? parsed.rate : 0,
      };
    }
  } catch (e) {
    // fall through to default
  }
  return { voice: DEFAULT_VOICE, rate: DEFAULT_RATE };
}

export async function saveTTSSettings(voice, rate) {
  const clampedRate = typeof rate === "number"
    ? Math.max(RATE_MIN, Math.min(RATE_MAX, rate))
    : 0;
  const settings = {
    voice: voice || "",
    rate: clampedRate,
    updatedAt: Date.now(),
  };
  await AsyncStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}

export async function getAudioExtForMode() {
  return AUDIO_EXT;
}

export { DEFAULT_VOICE, DEFAULT_RATE, AUDIO_EXT };
```

- [ ] **Step 2: 验证 Metro bundle 通过**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: 以 0 退出，输出以 `info Done writing bundle output` 结尾。

- [ ] **Step 3: Commit**

```bash
git add src/data/tts.js
git commit -m "$(cat <<'EOF'
Add TTS settings persistence and previewVoice wrapper

synthesizeChapter now auto-loads voice/rate from AsyncStorage when
not explicitly passed, so OCR/TXT import screens need no changes.
loadTTSSettings/saveTTSSettings persist to @mp3player:tts-settings
with rate clamped to [-50, 50]. previewVoice wraps the native
audition method.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 新增 TTSSettingsScreen

创建 `src/screens/TTSSettingsScreen.js`：列出 zh 语音（按 quality 分组）、语速滑块、premium 检测横幅、试听按钮、保存按钮。此任务创建屏幕但不接入导航（Task 5 接入）。

**Files:**
- Create: `src/screens/TTSSettingsScreen.js`

**Interfaces:**
- Consumes: Task 3 的 `getVoices` / `previewVoice` / `loadTTSSettings` / `saveTTSSettings`
- Produces: `TTSSettingsScreen` React 组件，props `{ onBack: () => void }`，供 Task 5 渲染

- [ ] **Step 1: 创建 `src/screens/TTSSettingsScreen.js`**

写入以下完整内容：

```jsx
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
```

- [ ] **Step 2: 验证 Metro bundle 通过**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: 以 0 退出，输出以 `info Done writing bundle output` 结尾。注意：此屏幕尚未被任何文件 import，Metro 不会报错（未被引用的文件不参与 bundle）；此门主要确认文件本身无语法错误（若 import 路径或语法有误，一旦 Task 5 引入即会暴露）。

- [ ] **Step 3: Commit**

```bash
git add src/screens/TTSSettingsScreen.js
git commit -m "$(cat <<'EOF'
Add TTSSettingsScreen for voice and rate selection

Lists zh voices grouped by quality (premium/enhanced/compact) with
radio selection and per-voice audition. Rate slider -50..+50 with
audition on release. Shows a banner guiding users to download premium
voices from system settings when none is installed. Save persists
via saveTTSSettings.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 接入 SettingsScreen + App.js 导航

在 `SettingsScreen` 新增"TTS 语音"行（显示当前 voice 名），点击进入 `TTSSettingsScreen`。在 `App.js` 新增 `view: "tts-settings"` 状态、`ttsVoiceLabel` state、加载/刷新逻辑、渲染分支。

**Files:**
- Modify: `src/screens/SettingsScreen.js`（新增 TTS 行 + `onTTSSettings` / `ttsVoiceLabel` props）
- Modify: `App.js`（import TTSSettingsScreen + loadTTSSettings/getVoices；新增 state、handlers、渲染分支）

**Interfaces:**
- Consumes: Task 4 的 `TTSSettingsScreen` 组件；Task 3 的 `loadTTSSettings` / `getVoices`
- Produces: 用户可从 我的 → 设置（齿轮）→ TTS 语音 进入设置页；保存后返回设置页，行右侧 voice 名刷新

- [ ] **Step 1: 在 `SettingsScreen.js` 增加 TTS 行**

在 `src/screens/SettingsScreen.js` 中，将函数签名改为接收新 props：

```jsx
function SettingsScreen({ onBack, onClearCache, onTTSSettings, ttsVoiceLabel }) {
```

然后在 `<ScrollView>` 内的 `<TouchableOpacity style={styles.row} onPress={handleClearCache}>` **之前**插入 TTS 行：

```jsx
        <TouchableOpacity style={styles.row} onPress={onTTSSettings}>
          <Text style={styles.rowText}>TTS 语音</Text>
          <View style={styles.rowRight}>
            <Text style={styles.rowValue}>{ttsVoiceLabel || "系统默认"}</Text>
            <Text style={styles.rowArrow}>›</Text>
          </View>
        </TouchableOpacity>
```

最后在 `styles` 对象中新增 `rowRight` 样式（与 `rowValue` 同级）：

```jsx
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
```

- [ ] **Step 2: 在 `App.js` 增加 import**

在 `App.js` 顶部 import 区，`import SettingsScreen from "./src/screens/SettingsScreen";` 之后添加：

```js
import TTSSettingsScreen from "./src/screens/TTSSettingsScreen";
```

在 import 区末尾（`import CreateEmptyBookModal` 之后）添加：

```js
import { loadTTSSettings, getVoices } from "./src/data/tts";
```

- [ ] **Step 3: 在 `App.js` 增加 ttsVoiceLabel state 与加载逻辑**

在 `const [showCreateEmptyBook, setShowCreateEmptyBook] = useState(false);` 之后添加：

```js
  const [ttsVoiceLabel, setTtsVoiceLabel] = useState("系统默认");
```

在组件内（`onOpenSettings` 定义附近，约 408 行之前）添加计算函数和加载 effect：

```js
  const computeTTSVoiceLabel = async () => {
    try {
      const settings = await loadTTSSettings();
      if (!settings.voice) return "系统默认";
      const voices = await getVoices();
      const found = voices.find((v) => v.identifier === settings.voice);
      return found ? found.name : "系统默认";
    } catch {
      return "系统默认";
    }
  };

  useEffect(() => {
    computeTTSVoiceLabel().then(setTtsVoiceLabel);
  }, []);
```

- [ ] **Step 4: 在 `App.js` 增加 TTS 设置 handler**

在 `onBackFromSettings` 之后添加：

```js
  const onTTSSettings = () => {
    setView("tts-settings");
  };

  const onBackFromTTSSettings = () => {
    computeTTSVoiceLabel().then(setTtsVoiceLabel);
    setView("settings");
  };
```

- [ ] **Step 5: 在 `App.js` 渲染分支增加 tts-settings**

将 `view === "settings"` 分支：

```jsx
  } else if (view === "settings") {
    content = (
      <SettingsScreen
        onBack={onBackFromSettings}
        onClearCache={onClearCache}
      />
    );
```

替换为：

```jsx
  } else if (view === "settings") {
    content = (
      <SettingsScreen
        onBack={onBackFromSettings}
        onClearCache={onClearCache}
        onTTSSettings={onTTSSettings}
        ttsVoiceLabel={ttsVoiceLabel}
      />
    );
  } else if (view === "tts-settings") {
    content = (
      <TTSSettingsScreen onBack={onBackFromTTSSettings} />
    );
```

- [ ] **Step 6: 验证 Metro bundle 通过**

Run:
```bash
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/test-bundle.js
```

Expected: 以 0 退出，输出以 `info Done writing bundle output` 结尾。

- [ ] **Step 7: Commit**

```bash
git add src/screens/SettingsScreen.js App.js
git commit -m "$(cat <<'EOF'
Wire TTSSettingsScreen into SettingsScreen and App

Add a TTS voice row to SettingsScreen showing the current voice name.
App.js gains a tts-settings view, ttsVoiceLabel state loaded on mount
and refreshed when returning from the settings screen.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## 完成后手动验证清单

由用户在 iOS 模拟器或真机执行（Claude 无法自动运行模拟器）：

- [ ] 我的 tab → 设置（齿轮）→ 出现"TTS 语音"行，右侧显示"系统默认"
- [ ] 点击 TTS 语音行 → 进入 TTSSettingsScreen
- [ ] 若设备无 premium 中文语音 → 顶部黄色横幅显示引导文案
- [ ] 语音列表按 Premium / Enhanced / Compact 分组（仅显示有 voice 的组）
- [ ] 第一项"系统默认"可选中
- [ ] 点某 voice 的"试听"→ 听到朗读；快速点另一个 voice 的试听 → 前一个被打断
- [ ] 拖动语速滑块到 +20%，松手后自动试听当前选中 voice + 新语速
- [ ] 选中某 voice → 点保存 → 弹"已保存"→ 自动返回设置页 → TTS 语音行右侧显示新 voice 名
- [ ] 跑一次 TXT 导入 → 生成的音频使用新 voice + 语速
- [ ] 杀进程重启 → 设置仍在，设置页 voice 名仍正确
