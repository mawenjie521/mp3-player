import { NativeModules } from "react-native";

const { TTSWriter } = NativeModules;

const DEFAULT_VOICE = "";
const DEFAULT_RATE = 0;
const AUDIO_EXT = "m4a";

export async function synthesizeChapter(text, outputPath, voice, rate) {
  if (!TTSWriter) {
    throw new Error("TTSWriter native module not available");
  }
  const effectiveVoice = voice || DEFAULT_VOICE;
  const effectiveRate = rate != null ? rate : DEFAULT_RATE;
  const result = await TTSWriter.synthesize(text, outputPath, effectiveVoice, effectiveRate);
  return result.path;
}

export async function getVoices() {
  if (!TTSWriter) {
    return [];
  }
  return TTSWriter.getVoices();
}

export async function getAudioExtForMode() {
  return AUDIO_EXT;
}

export { DEFAULT_VOICE, DEFAULT_RATE, AUDIO_EXT };
