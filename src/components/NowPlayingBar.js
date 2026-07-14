import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { COLORS } from "../data/constants";

function NowPlayingBar({ currentTrack, position = 0, duration = 0, isPlaying = false, onPress, accentColor = COLORS.accent }) {
  if (!currentTrack) return null;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image source={{ uri: currentTrack.artwork }} style={styles.thumb} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
      </View>
      <Text style={styles.playIcon}>{isPlaying ? "⏸" : "▶"}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: accentColor }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: COLORS.separator,
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    color: COLORS.primaryText,
    fontSize: 15,
    fontWeight: "600",
  },
  artist: {
    color: COLORS.secondaryText,
    fontSize: 12,
    marginTop: 1,
  },
  playIcon: {
    color: COLORS.primaryText,
    fontSize: 16,
  },
  progressTrack: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    height: 1.5,
    borderRadius: 0.75,
    backgroundColor: COLORS.separator,
  },
  progressFill: {
    height: 1.5,
    borderRadius: 0.75,
  },
});

export default NowPlayingBar;
