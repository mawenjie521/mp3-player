import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { COLORS } from "../data/constants";

function NowPlayingBar({ currentTrack, onPress }) {
  if (!currentTrack) return null;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image source={{ uri: currentTrack.artwork }} style={styles.thumb} />
      <View style={styles.info}>
        <Text style={styles.label}>正在播放</Text>
        <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
      </View>
      <Text style={styles.arrow}>▶</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#C20C0C0D",
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: "#333",
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  label: {
    color: COLORS.secondaryText,
    fontSize: 11,
    marginBottom: 2,
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
  arrow: {
    color: COLORS.accent,
    fontSize: 14,
    marginLeft: 8,
  },
});

export default NowPlayingBar;
