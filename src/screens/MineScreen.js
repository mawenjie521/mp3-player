import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";
import { filterTracks } from "../data/filterTracks";
import TrackList from "../components/TrackList";

const MINE_TABS = [
  { key: "favorites", label: "收藏" },
  { key: "recent", label: "最近播放" },
  { key: "imported", label: "导入音乐" },
];

function MineScreen({ allTracks, currentTrack, onSelect, onShowPlayer, favorites, recent, onImport, initialSubTab = "favorites" }) {
  const [mineSubTab, setMineSubTab] = useState(initialSubTab);

  const filtered = useMemo(
    () => filterTracks(mineSubTab, allTracks, favorites, recent),
    [mineSubTab, allTracks, favorites, recent]
  );

  const emptyText = useMemo(() => {
    if (mineSubTab === "favorites") return "还没有收藏的歌曲";
    if (mineSubTab === "recent") return "还没有播放记录";
    return "还没有导入音乐";
  }, [mineSubTab]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>我的</Text>
      </View>
      <View style={styles.tabBar}>
        {MINE_TABS.map((tab) => {
          const isActive = tab.key === mineSubTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => setMineSubTab(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>
      {mineSubTab === "imported" && (
        <View style={styles.importBar}>
          <TouchableOpacity onPress={onImport} style={styles.importButton}>
            <Text style={styles.importButtonText}>+ 导入音乐</Text>
          </TouchableOpacity>
        </View>
      )}
      <TrackList
        tracks={filtered}
        currentTrack={currentTrack}
        onSelect={(item) => onSelect(item, filtered, mineSubTab)}
        onShowPlayer={onShowPlayer}
        emptyText={emptyText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: {
    color: COLORS.primaryText,
    fontSize: 22,
    fontWeight: "700",
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  tab: {
    marginRight: 24,
    paddingVertical: 8,
    position: "relative",
  },
  tabText: {
    color: COLORS.secondaryText,
    fontSize: 14,
  },
  tabTextActive: {
    color: COLORS.accent,
    fontWeight: "600",
  },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.accent,
  },
  importBar: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  importButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignSelf: "flex-start",
  },
  importButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default MineScreen;
