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

export function sanitizeTitle(title) {
  const trimmed = title.trim();
  if (!trimmed) return "";
  const cleaned = trimmed.replace(/[/:\x00\n\t]/g, "_");
  return cleaned.length > 80 ? cleaned.substring(0, 80) : cleaned;
}

export async function computeBookDir(title, bookId) {
  const base = sanitizeTitle(title);
  if (!base) return `${OCR_DIR}/${bookId}`;
  const candidate = `${OCR_DIR}/${base}`;
  try {
    if (!(await RNFS.exists(candidate))) return candidate;
  } catch {
    return candidate;
  }
  for (let i = 2; i <= 99; i++) {
    const next = `${OCR_DIR}/${base} (${i})`;
    try {
      if (!(await RNFS.exists(next))) return next;
    } catch {
      return next;
    }
  }
  return `${OCR_DIR}/${bookId}`;
}

// Derive the book's storage folder. Prefer an explicitly stored `bookDir`
// (empty books have no cover/chapter to derive from). Then fall back to
// coverImage, then first chapter audio, then bookId.
export function getBookDir(book) {
  if (book.bookDir) return resolvePathNoProtocol(book.bookDir);
  if (book.coverImage) {
    const path = resolvePathNoProtocol(book.coverImage);
    const lastSlash = path.lastIndexOf("/");
    return lastSlash > 0 ? path.substring(0, lastSlash) : path;
  }
  const chWithAudio = book.chapters?.find((ch) => ch.audioPath);
  if (chWithAudio) {
    const path = resolvePathNoProtocol(chWithAudio.audioPath);
    const lastSlash = path.lastIndexOf("/");
    return lastSlash > 0 ? path.substring(0, lastSlash) : path;
  }
  return `${OCR_DIR}/${book.id}`;
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
  const book = existing.find((b) => b.id === bookId);
  const next = existing.filter((b) => b.id !== bookId);
  await saveJSON(STORAGE_KEY, next);
  if (book) {
    try {
      await RNFS.unlink(getBookDir(book));
    } catch {
      // Directory may not exist - ignore
    }
  }
  return next;
}

export async function appendOCRChapters(bookId, newChapters, coverImage) {
  const existing = await loadOCRNovels();
  const next = existing.map((b) => {
    if (b.id !== bookId) return b;
    const updated = { ...b, chapters: [...b.chapters, ...newChapters] };
    if (coverImage && !b.coverImage) {
      updated.coverImage = coverImage;
    }
    return updated;
  });
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

export function expandEmptyBooks(books) {
  return books
    .filter((b) => b.isOCR && b.chapters.length === 0)
    .map((b) => ({
      id: `${b.id}__empty`,
      title: b.title,
      artist: "暂无章节，长按添加",
      artwork: "",
      isNovel: true,
      isOCR: true,
      isEmptyBook: true,
      bookId: b.id,
      url: "",
    }));
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
