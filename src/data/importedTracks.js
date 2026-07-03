import RNFS from "react-native-fs";
import DocumentPicker from "react-native-document-picker";
import { loadJSON, saveJSON } from "./storage";

const STORAGE_KEY = "@mp3player:imported";

export async function loadImported() {
  return loadJSON(STORAGE_KEY, []);
}

export async function pickAndCopyTrack() {
  const result = await DocumentPicker.pick({
    type: ["audio/mpeg"],
  });
  const { uri: pickerUri, name } = result[0];

  const timestamp = Date.now();
  const filename = `imported-${timestamp}.mp3`;
  const destPath = `${RNFS.DocumentDirectoryPath}/${filename}`;
  await RNFS.copyFile(pickerUri, destPath);

  const title = (name || "")
    .replace(/\.mp3$/i, "")
    .replace(/[-_]+/g, " ")
    .trim() || "未知曲目";

  return {
    id: `imported-${timestamp}`,
    url: `file://${destPath}`,
    title,
    artist: "导入",
    artwork: `https://picsum.photos/seed/imported-${timestamp}/600/600`,
    lrc: "",
    isImported: true,
  };
}

export function persistImported(tracks) {
  return saveJSON(STORAGE_KEY, tracks);
}
