import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { COLORS } from "../data/constants";
import BookCover from "./BookCover";

function TrackList({ tracks, currentTrack, onSelect, onLongPress, emptyText = "暂无内容" }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!currentTrack) return;
    const index = tracks.findIndex((t) => t.id === currentTrack.id);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false });
    }
  }, [currentTrack?.id, tracks]);

  const renderItem = ({ item }) => {
    const isActive = currentTrack && item.id === currentTrack.id;
    return (
      <TouchableOpacity
        style={styles.listRow}
        onPress={() => onSelect(item)}
        onLongPress={() => onLongPress && onLongPress(item)}
        activeOpacity={0.6}
      >
        <BookCover uri={item.artwork} title={item.title} style={styles.listThumb} />
        <View style={styles.listInfo}>
          <View style={styles.listTitleRow}>
            <Text style={[styles.listTitle, isActive && styles.listTitleActive]} numberOfLines={1}>
              {item.title}
            </Text>
            {item.isOCR && (
              <View style={styles.ocrBadge}>
                <Text style={styles.ocrBadgeText}>OCR</Text>
              </View>
            )}
          </View>
          <Text style={styles.listArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        {isActive && <Text style={styles.listActiveIcon}>▶</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <>
      {tracks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={tracks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
          onScrollToIndexFailed={() => {
            setTimeout(() => {
              const idx = tracks.findIndex((t) => currentTrack && t.id === currentTrack.id);
              if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.5 });
            }, 100);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
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
  listTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ocrBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  ocrBadgeText: {
    color: COLORS.primaryText,
    fontSize: 9,
    fontWeight: "700",
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

export default TrackList;
