export function filterTracks(activeTab, allTracks, favorites, recent) {
  if (activeTab === "favorites") return allTracks.filter((t) => favorites.includes(t.id));
  if (activeTab === "recent") return recent.map((id) => allTracks.find((t) => t.id === id)).filter(Boolean);
  if (activeTab === "imported") return allTracks.filter((t) => t.isImported);
  return allTracks;
}
