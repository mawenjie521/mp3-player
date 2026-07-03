import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image, FlatList } from "react-native";
import { COLORS } from "../data/constants";

const TABS = [
  { key: "all", label: "全部" },
  { key: "favorites", label: "收藏" },
  { key: "recent", label: "最近播放" },
];

function PlaylistScreen({ playlist, currentTrack, onSelect, activeTab, onTabChange, favorites, recent }) {
  const filtered = useMemo(() => {
    if (activeTab === "favorites") return playlist.filter((t) => favorites.includes(t.id));
    if (activeTab === "recent") return recent.map((id) => playlist.find((t) => t.id === id)).filter(Boolean);
    return playlist;
  }, [activeTab, playlist, favorites, recent]);

  const subtitle = useMemo(() => {
    if (activeTab === "favorites") return `已收藏 ${filtered.length} 首`;
    if (activeTab === "recent") return `最近播放过 ${filtered.length} 首`;
    return `共 ${playlist.length} 首`;
  }, [activeTab, filtered.length, playlist.length]);

  const renderItem = ({ item }) => {
    const isActive = currentTrack && item.id === currentTrack.id;
    return (
      <TouchableOpacity
        style={styles.listRow}
        onPress={() => onSelect(playlist.indexOf(item))}
        activeOpacity={0.6}
      >
        <Image source={{ uri: item.artwork }} style={styles.listThumb} />
        <View style={styles.listInfo}>
          <Text style={[styles.listTitle, isActive && styles.listTitleActive]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.listArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        {isActive && <Text style={styles.listActiveIcon}>▶</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.glowTop} />
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>播放列表</Text>
        <Text style={styles.listHeaderCount}>{subtitle}</Text>
      </View>
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => onTabChange(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {activeTab === "favorites" ? "还没有收藏的歌曲" : "还没有播放记录"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  glowTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: COLORS.accent,
    opacity: 0.05,
  },
  listHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  listHeaderTitle: {
    color: COLORS.primaryText,
    fontSize: 22,
    fontWeight: "700",
  },
  listHeaderCount: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 4,
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
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  listThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: "#333",
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listTitle: {
    color: COLORS.primaryText,
    fontSize: 16,
  },
  listTitleActive: {
    color: COLORS.accent,
  },
  listArtist: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  listActiveIcon: {
    color: COLORS.accent,
    fontSize: 16,
    marginLeft: 8,
  },
  listSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ffffff10",
    marginLeft: 84,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    color: COLORS.secondaryText,
    fontSize: 14,
  },
});

export default PlaylistScreen;
