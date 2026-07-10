import { NativeModules } from "react-native";

const { TTSWriter } = NativeModules;

export async function synthesizeChapter(text, outputPath) {
  if (!TTSWriter) {
    throw new Error("TTSWriter native module not available");
  }
  const result = await TTSWriter.synthesize(text, outputPath);
  return result.path;
}
