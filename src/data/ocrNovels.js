import RNFS from "react-native-fs";
import { loadJSON, saveJSON } from "./storage";

const STORAGE_KEY = "@mp3player:ocr-novels";
const OCR_DIR = `${RNFS.DocumentDirectoryPath}/ocr-novels`;

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

export function expandOCRChapters(books) {
  return books.flatMap((book) =>
    book.chapters
      .map((ch, i) => ({ ch, i }))
      .filter(({ ch }) => !ch.ttsFailed)
      .map(({ ch, i }) => ({
        id: `${book.id}/${ch.id}`,
        url: ch.audioPath,
        title: `${book.title} - 第 ${i + 1} 章`,
        artist: "OCR 朗读",
        artwork: book.coverImage,
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
          const path = ch.audioPath.replace("file://", "");
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
