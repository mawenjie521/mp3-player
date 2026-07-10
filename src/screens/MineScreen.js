import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, FlatList, Alert } from "react-native";
import { COLORS } from "../data/constants";
import { filterTracks } from "../data/filterTracks";
import TrackList from "../components/TrackList";

const MINE_TABS = [
  { key: "favorites", label: "收藏" },
  { key: "recent", label: "最近播放" },
  { key: "imported", label: "导入音乐" },
  { key: "ocr", label: "OCR 小说" },
];

function MineScreen({
  allTracks,
  currentTrack,
  onSelect,
  onShowPlayer,
  favorites,
  recent,
  onImport,
  mineSubTab,
  onSubTabChange,
  ocrNovels,
  onDeleteOCRNovel,
}) {
  const filtered = useMemo(
    () => filterTracks(mineSubTab, allTracks, favorites, recent),
    [mineSubTab, allTracks, favorites, recent]
  );

  const emptyText = useMemo(() => {
    if (mineSubTab === "favorites") return "还没有收藏的歌曲";
    if (mineSubTab === "recent") return "还没有播放记录";
    if (mineSubTab === "imported") return "还没有导入音乐";
    return "还没有 OCR 小说";
  }, [mineSubTab]);

  const confirmDelete = (book) => {
    Alert.alert("删除确认", `确定删除《${book.title}》？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => onDeleteOCRNovel(book.id) },
    ]);
  };

  const renderOcrBook = ({ item }) => (
    <View style={styles.bookRow}>
      <Image source={{ uri: item.coverImage }} style={styles.bookCover} />
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.bookMeta}>{item.chapters.length} 章</Text>
      </View>
      <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
        <Text style={styles.deleteBtnText}>删除</Text>
      </TouchableOpacity>
    </View>
  );

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
              onPress={() => onSubTabChange(tab.key)}
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
      {mineSubTab === "ocr" ? (
        ocrNovels.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        ) : (
          <FlatList
            data={ocrNovels}
            keyExtractor={(item) => item.id}
            renderItem={renderOcrBook}
            ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
          />
        )
      ) : (
        <TrackList
          tracks={filtered}
          currentTrack={currentTrack}
          onSelect={(item) => onSelect(item, filtered, mineSubTab)}
          onShowPlayer={onShowPlayer}
          emptyText={emptyText}
        />
      )}
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
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  bookCover: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: "#333",
  },
  bookInfo: {
    flex: 1,
    marginLeft: 12,
  },
  bookTitle: {
    color: COLORS.primaryText,
    fontSize: 16,
  },
  bookMeta: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  deleteBtnText: {
    color: COLORS.accent,
    fontSize: 13,
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

export default MineScreen;
