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
