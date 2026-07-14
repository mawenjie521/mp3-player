import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, FlatList, Alert } from "react-native";
import { COLORS, TYPO } from "../data/constants";
import BookCover from "../components/BookCover";
import NowPlayingBar from "../components/NowPlayingBar";
import { expandOCRChapters } from "../data/ocrNovels";

function NovelDetailScreen({ novel, currentTrack, onSelect, onShowPlayer, onBack, onAddChapters, onDeleteOCRNovel }) {
  const tracks = useMemo(() => {
    if (novel.isOCR) return expandOCRChapters([novel.book]);
    return [novel.track];
  }, [novel]);

  const handleDelete = () => {
    Alert.alert("删除确认", `确定删除《${novel.title}》？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          await onDeleteOCRNovel(novel.id);
          onBack();
        },
      },
    ]);
  };

  const handleMenu = () => {
    if (!novel.isOCR) return;
    const actions = [
      { text: "添加章节", onPress: () => onAddChapters(novel.id) },
      { text: "删除", style: "destructive", onPress: handleDelete },
      { text: "取消", style: "cancel" },
    ];
    Alert.alert(novel.title, null, actions);
  };

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    onSelect(tracks[0], tracks, "novels");
  };

  const renderChapter = ({ item, index }) => {
    const isActive = currentTrack && item.id === currentTrack.id;
    return (
      <TouchableOpacity
        style={styles.chapterRow}
        onPress={() => onSelect(item, tracks, "novels")}
        activeOpacity={0.6}
      >
        <Text style={[styles.chapterNum, { color: isActive ? COLORS.accentNovel : COLORS.secondaryText }]}>
          第{index + 1}章
        </Text>
        <Text
          style={[styles.chapterTitle, { color: isActive ? COLORS.accentNovel : COLORS.primaryText }]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        {isActive && <Text style={styles.activeIcon}>▶</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Text style={styles.headerBtnIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, TYPO.titleMedium]} numberOfLines={1}>{novel.title}</Text>
        <TouchableOpacity onPress={handleMenu} style={styles.headerBtn}>
          {novel.isOCR ? <Text style={styles.headerBtnIcon}>⋯</Text> : null}
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <BookCover uri={novel.coverImage} title={novel.title} style={styles.infoCover} accentColor={COLORS.accentNovel} />
        <View style={styles.infoMeta}>
          <Text style={styles.infoTitle} numberOfLines={1}>{novel.title}</Text>
          <Text style={styles.infoChapterCount}>{novel.chapterCount} 章</Text>
          <View style={styles.btnRow}>
            <TouchableOpacity onPress={handlePlayAll} style={styles.playBtn}>
              <Text style={styles.playBtnText}>▶ 播放</Text>
            </TouchableOpacity>
            {novel.isOCR && (
              <TouchableOpacity onPress={() => onAddChapters(novel.id)} style={styles.addChBtn}>
                <Text style={styles.addChBtnText}>+ 添加章节</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <Text style={[styles.sectionTitle, TYPO.titleMedium]}>章节</Text>
      <View style={{ flex: 1 }}>
        {tracks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>暂无章节</Text>
          </View>
        ) : (
          <FlatList
            data={tracks}
            keyExtractor={(item) => item.id}
            renderItem={renderChapter}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
      <NowPlayingBar
        currentTrack={currentTrack}
        position={0}
        duration={0}
        isPlaying={false}
        onPress={onShowPlayer}
        accentColor={COLORS.accentNovel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnIcon: {
    color: COLORS.primaryText,
    fontSize: 24,
  },
  headerTitle: {
    flex: 1,
    color: COLORS.primaryText,
    textAlign: "center",
    marginHorizontal: 8,
  },
  infoCard: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  infoCover: {
    width: 96,
    height: 96,
    borderRadius: 8,
    backgroundColor: COLORS.separator,
  },
  infoMeta: {
    flex: 1,
    marginLeft: 16,
  },
  infoTitle: {
    color: COLORS.primaryText,
    fontSize: 20,
    fontWeight: "700",
  },
  infoChapterCount: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 4,
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  playBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COLORS.accentNovel,
  },
  playBtnText: {
    color: COLORS.surface,
    fontSize: 13,
    fontWeight: "600",
  },
  addChBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.accentNovel,
  },
  addChBtnText: {
    color: COLORS.accentNovel,
    fontSize: 13,
    fontWeight: "600",
  },
  sectionTitle: {
    color: COLORS.primaryText,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  chapterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chapterNum: {
    fontSize: 12,
    width: 56,
  },
  chapterTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  activeIcon: {
    color: COLORS.accentNovel,
    fontSize: 12,
    marginLeft: 8,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.separator,
    marginLeft: 16,
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

export default NovelDetailScreen;
