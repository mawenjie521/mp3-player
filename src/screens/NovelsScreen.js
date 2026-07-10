import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";
import TrackList from "../components/TrackList";

function NovelsScreen({ tracks, currentTrack, onSelect, onShowPlayer, onStartImport }) {
  const handleSelect = (item) => {
    const queue = item.bookId
      ? tracks.filter((t) => t.bookId === item.bookId)
      : tracks;
    onSelect(item, queue, "novels");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>小说</Text>
          <Text style={styles.subtitle}>共 {tracks.length} 首</Text>
        </View>
        <TouchableOpacity onPress={onStartImport} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <TrackList
        tracks={tracks}
        currentTrack={currentTrack}
        onSelect={handleSelect}
        onShowPlayer={onShowPlayer}
        emptyText="还没有有声书"
      />
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
  title: {
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
});

export default NovelsScreen;
