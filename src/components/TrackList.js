import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { COLORS } from "../data/constants";
import BookCover from "./BookCover";

function TrackList({ tracks, currentTrack, onSelect, onLongPress, emptyText = "暂无内容", accentColor = COLORS.accent }) {
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
        <BookCover uri={item.artwork} title={item.title} style={styles.listThumb} accentColor={accentColor} />
        <View style={styles.listInfo}>
          <View style={styles.listTitleRow}>
            <Text style={[styles.listTitle, { color: isActive ? accentColor : COLORS.primaryText }]} numberOfLines={1}>
              {item.title}
            </Text>
            {item.isOCR && (
              <View style={styles.ocrBadge}>
                <Text style={[styles.ocrBadgeText, { color: accentColor }]}>OCR</Text>
              </View>
            )}
          </View>
          <Text style={styles.listArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        {isActive && <Text style={[styles.listActiveIcon, { color: accentColor }]}>▍▍▍</Text>}
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
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  listThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.separator,
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  listTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ocrBadge: {
    marginLeft: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: COLORS.separator,
  },
  ocrBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  listArtist: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
  listActiveIcon: {
    fontSize: 14,
    marginLeft: 8,
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
    fontSize: 14,
  },
});

export default TrackList;
