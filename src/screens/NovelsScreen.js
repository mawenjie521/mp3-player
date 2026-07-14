import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from "react-native";
import { COLORS, TYPO } from "../data/constants";
import BookCover from "../components/BookCover";

function NovelsScreen({ cards, currentTrack, onSelectNovel, onAdd, onDeleteOCRNovel }) {
  const handleLongPress = (card) => {
    if (!card.isOCR) return;
    Alert.alert(card.title, null, [
      {
        text: "删除",
        style: "destructive",
        onPress: () => onDeleteOCRNovel(card.id),
      },
      { text: "取消", style: "cancel" },
    ]);
  };

  const isCardPlaying = (card) =>
    currentTrack && (currentTrack.bookId === card.id || currentTrack.id === card.id);

  const renderItem = ({ item: card }) => {
    const playing = isCardPlaying(card);
    return (
      <TouchableOpacity
        style={styles.cell}
        onPress={() => onSelectNovel(card)}
        onLongPress={() => handleLongPress(card)}
        activeOpacity={0.6}
      >
        <View style={styles.coverWrap}>
          <BookCover uri={card.coverImage} title={card.title} style={styles.cover} accentColor={COLORS.accentNovel} />
          {playing && (
            <View style={styles.playingBadge}>
              <Text style={styles.playingBadgeIcon}>▶</Text>
            </View>
          )}
        </View>
        <Text style={styles.cellTitle} numberOfLines={1}>{card.title}</Text>
        <Text style={styles.cellMeta}>
          {card.chapterCount} 章{card.isOCR ? " · OCR" : ""}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, TYPO.titleLarge]}>小说</Text>
          <Text style={[styles.subtitle, TYPO.caption]}>{cards.length} 本</Text>
        </View>
        <TouchableOpacity onPress={onAdd} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      {cards.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>还没有有声书</Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  headerTitle: {
    color: COLORS.primaryText,
  },
  subtitle: {
    color: COLORS.secondaryText,
    marginTop: 4,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.accentNovel,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: {
    color: COLORS.accentNovel,
    fontSize: 22,
    fontWeight: "400",
    marginTop: -3,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  row: {
    gap: 12,
    marginBottom: 16,
  },
  cell: {
    flex: 1,
  },
  coverWrap: {
    position: "relative",
    aspectRatio: 1,
    marginBottom: 6,
  },
  cover: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: COLORS.separator,
  },
  playingBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  playingBadgeIcon: {
    color: COLORS.accentNovel,
    fontSize: 12,
    marginLeft: 2,
  },
  cellTitle: {
    color: COLORS.primaryText,
    fontSize: 14,
    fontWeight: "600",
  },
  cellMeta: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 2,
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

export default NovelsScreen;
