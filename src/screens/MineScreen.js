import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from "react-native";
import { COLORS, TYPO } from "../data/constants";
import { filterTracks } from "../data/filterTracks";
import TrackList from "../components/TrackList";
import BookCover from "../components/BookCover";

const MINE_TABS = [
  { key: "favorites", label: "收藏", accent: "accent" },
  { key: "recent", label: "最近播放", accent: "accent" },
  { key: "imported", label: "导入音乐", accent: "accent" },
  { key: "ocr", label: "OCR 小说", accent: "accentNovel" },
];

function MineScreen({
  allTracks,
  currentTrack,
  onSelect,
  favorites,
  recent,
  onImport,
  mineSubTab,
  onSubTabChange,
  ocrNovels,
  onDeleteOCRNovel,
  onAddChapters,
  onOpenSettings,
}) {
  const filtered = useMemo(
    () => filterTracks(mineSubTab, allTracks, favorites, recent),
    [mineSubTab, allTracks, favorites, recent]
  );

  const isOcrTab = mineSubTab === "ocr";
  const activeAccent = isOcrTab ? COLORS.accentNovel : COLORS.accent;

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

  const handleBookLongPress = (book) => {
    const actions = [];
    if (onAddChapters) {
      actions.push({ text: "添加章节", onPress: () => onAddChapters(book.id) });
    }
    actions.push({ text: "删除", style: "destructive", onPress: () => confirmDelete(book) });
    Alert.alert(book.title, null, [...actions, { text: "取消", style: "cancel" }]);
  };

  const renderOcrBook = ({ item }) => (
    <TouchableOpacity
      style={styles.bookRow}
      onLongPress={() => handleBookLongPress(item)}
      activeOpacity={0.6}
    >
      <BookCover uri={item.coverImage} title={item.title} style={styles.bookCover} accentColor={COLORS.accentNovel} />
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.bookMeta}>{item.chapters.length} 章</Text>
      </View>
      <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
        <Text style={styles.deleteBtnText}>删除</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, TYPO.titleLarge]}>我的</Text>
        <TouchableOpacity onPress={onOpenSettings} style={styles.settingsBtn}>
          <Text style={styles.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tabBar}>
        {MINE_TABS.map((tab) => {
          const isActive = tab.key === mineSubTab;
          const tabAccent = tab.accent === "accentNovel" ? COLORS.accentNovel : COLORS.accent;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => onSubTabChange(tab.key)}
            >
              <Text style={[
                styles.tabText,
                { color: isActive ? tabAccent : COLORS.secondaryText, fontWeight: isActive ? "600" : "400" },
              ]}>
                {tab.label}
              </Text>
              {isActive && <View style={[styles.tabUnderline, { backgroundColor: tabAccent }]} />}
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
      {isOcrTab ? (
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
          emptyText={emptyText}
          accentColor={activeAccent}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: {
    color: COLORS.primaryText,
  },
  settingsBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsIcon: {
    color: COLORS.primaryText,
    fontSize: 22,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tab: {
    marginRight: 24,
    paddingVertical: 8,
    position: "relative",
  },
  tabText: {
    fontSize: 14,
  },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  importBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  importButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    alignSelf: "flex-start",
  },
  importButtonText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: "600",
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bookCover: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: COLORS.separator,
  },
  bookInfo: {
    flex: 1,
    marginLeft: 12,
  },
  bookTitle: {
    color: COLORS.primaryText,
    fontSize: 15,
    fontWeight: "600",
  },
  bookMeta: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.accentNovel,
  },
  deleteBtnText: {
    color: COLORS.accentNovel,
    fontSize: 13,
  },
  listSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.separator,
    marginLeft: 76,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    color: COLORS.secondaryText,
    fontSize: 16,
  },
});

export default MineScreen;
