export function filterTracks(scope, allTracks, favorites, recent) {
  if (scope === "songs") return allTracks.filter((t) => !t.isNovel && !t.isImported);
  if (scope === "novels") return allTracks.filter((t) => t.isNovel);
  if (scope === "favorites") return allTracks.filter((t) => favorites.includes(t.id));
  if (scope === "recent") return recent.map((id) => allTracks.find((t) => t.id === id)).filter(Boolean);
  if (scope === "imported") return allTracks.filter((t) => t.isImported);
  return allTracks;
}
