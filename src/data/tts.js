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
