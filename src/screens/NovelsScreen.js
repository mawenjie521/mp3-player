import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from "react-native";
import { COLORS } from "../data/constants";
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
        style={styles.row}
        onPress={() => onSelectNovel(card)}
        onLongPress={() => handleLongPress(card)}
        activeOpacity={0.6}
      >
        <BookCover uri={card.coverImage} title={card.title} style={styles.cover} />
        <View style={styles.info}>
          <Text style={[styles.title, playing && styles.titleActive]} numberOfLines={1}>
            {card.title}
          </Text>
          <Text style={styles.meta}>{card.chapterCount} 章</Text>
        </View>
        {playing && <Text style={styles.activeIcon}>▶</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>小说</Text>
          <Text style={styles.subtitle}>共 {cards.length} 本</Text>
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
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 4,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: {
    color: COLORS.accent,
    fontSize: 22,
    fontWeight: "400",
    marginTop: -3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: "#333",
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    color: COLORS.primaryText,
    fontSize: 16,
  },
  titleActive: {
    color: COLORS.accent,
  },
  meta: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  activeIcon: {
    color: COLORS.accent,
    fontSize: 16,
    marginLeft: 8,
  },
  separator: {
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

export default NovelsScreen;
