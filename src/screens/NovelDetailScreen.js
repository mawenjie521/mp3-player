import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from "react-native";
import { COLORS } from "../data/constants";
import TrackList from "../components/TrackList";
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{novel.title}</Text>
        {novel.isOCR ? (
          <TouchableOpacity onPress={() => onAddChapters(novel.id)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View style={styles.infoCard}>
        <BookCover uri={novel.coverImage} title={novel.title} style={styles.infoCover} />
        <View style={styles.infoMeta}>
          <Text style={styles.infoTitle} numberOfLines={1}>{novel.title}</Text>
          <Text style={styles.infoChapterCount}>{novel.chapterCount} 章</Text>
        </View>
        {novel.isOCR && (
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>删除</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <TrackList
          tracks={tracks}
          currentTrack={currentTrack}
          onSelect={(item) => onSelect(item, tracks, "novels")}
          emptyText="暂无章节"
        />
      </View>
      <NowPlayingBar currentTrack={currentTrack} onPress={onShowPlayer} />
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    color: COLORS.accent,
    fontSize: 16,
  },
  title: {
    color: COLORS.primaryText,
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: {
    color: COLORS.accent,
    fontSize: 20,
    fontWeight: "400",
    marginTop: -3,
  },
  headerSpacer: {
    width: 32,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ffffff10",
  },
  infoCover: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#333",
  },
  infoMeta: {
    flex: 1,
    marginLeft: 16,
  },
  infoTitle: {
    color: COLORS.primaryText,
    fontSize: 18,
    fontWeight: "600",
  },
  infoChapterCount: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 4,
  },
  deleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  deleteBtnText: {
    color: COLORS.accent,
    fontSize: 13,
  },
});

export default NovelDetailScreen;
