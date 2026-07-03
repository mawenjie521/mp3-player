export function parseLRC(lrc) {
  if (!lrc) return [];
  const lines = lrc.split("\n");
  const result = [];
  const timeRe = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  for (const line of lines) {
    const times = [...line.matchAll(timeRe)];
    const text = line.replace(timeRe, "").trim();
    if (times.length === 0 || !text) continue;
    for (const m of times) {
      const sec = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / 1000;
      result.push({ time: sec, text });
    }
  }
  result.sort((a, b) => a.time - b.time);
  return result;
}

export function findCurrentIndex(parsed, position) {
  if (parsed.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].time <= position) idx = i;
    else break;
  }
  return idx;
}
