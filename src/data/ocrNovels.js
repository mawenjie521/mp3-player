import RNFS from "react-native-fs";
import { loadJSON, saveJSON } from "./storage";

const STORAGE_KEY = "@mp3player:ocr-novels";
const OCR_DIR = `${RNFS.DocumentDirectoryPath}/ocr-novels`;

// Stored paths may be absolute with an old Application UUID from a previous
// install. Extract the relative part after /Documents/ and re-anchor to the
// current Documents directory so paths survive app reinstalls.
function resolvePath(storedPath) {
  if (!storedPath) return storedPath;
  const marker = "/Documents/";
  const idx = storedPath.indexOf(marker);
  if (idx < 0) return storedPath;
  const relative = storedPath.substring(idx + marker.length);
  return `file://${RNFS.DocumentDirectoryPath}/${relative}`;
}

function resolvePathNoProtocol(storedPath) {
  return resolvePath(storedPath).replace("file://", "");
}

export async function loadOCRNovels() {
  return loadJSON(STORAGE_KEY, []);
}

export async function saveOCRNovel(book) {
  const existing = await loadOCRNovels();
  const next = [book, ...existing];
  await saveJSON(STORAGE_KEY, next);
  return next;
}

export async function deleteOCRNovel(bookId) {
  const existing = await loadOCRNovels();
  const next = existing.filter((b) => b.id !== bookId);
  await saveJSON(STORAGE_KEY, next);
  try {
    await RNFS.unlink(`${OCR_DIR}/${bookId}`);
  } catch {
    // Directory may not exist - ignore
  }
  return next;
}

export async function appendOCRChapters(bookId, newChapters) {
  const existing = await loadOCRNovels();
  const next = existing.map((b) =>
    b.id === bookId
      ? { ...b, chapters: [...b.chapters, ...newChapters] }
      : b
  );
  await saveJSON(STORAGE_KEY, next);
  return next;
}

export function expandOCRChapters(books) {
  return books.flatMap((book) =>
    book.chapters
      .map((ch, i) => ({ ch, i }))
      .filter(({ ch }) => !ch.ttsFailed)
      .map(({ ch, i }) => ({
        id: `${book.id}/${ch.id}`,
        url: resolvePath(ch.audioPath),
        title: `${book.title} - 第 ${i + 1} 章`,
        artist: "OCR 朗读",
        artwork: resolvePath(book.coverImage),
        lrc: "",
        category: "OCR 小说",
        isNovel: true,
        isOCR: true,
        bookId: book.id,
      }))
  );
}

export async function checkOCRFileExistence(books) {
  const results = await Promise.all(
    books.map(async (book) => {
      const chapters = await Promise.all(
        book.chapters.map(async (ch) => {
          const path = resolvePathNoProtocol(ch.audioPath);
          let exists = true;
          try {
            exists = await RNFS.exists(path);
          } catch {
            exists = false;
          }
          return { ...ch, ttsFailed: !exists };
        })
      );
      return { ...book, chapters };
    })
  );
  return results;
}
