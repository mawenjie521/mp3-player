import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";

function Controls({ isPlaying, onPrev, onNext, onTogglePlay, repeatMode, onToggleRepeat }) {
  const accent = (on) => (on ? COLORS.accent : COLORS.secondaryText);
  const repeatIcon = repeatMode === "track" ? "🔂" : "🔁";

  return (
    <View style={styles.controls}>
      <TouchableOpacity onPress={onToggleRepeat} style={styles.sideButton}>
        <Text style={[styles.sideIcon, { color: accent(repeatMode !== "off") }]}>{repeatIcon}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onPrev} style={styles.controlButton}>
        <Text style={styles.controlIcon}>⏮</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onTogglePlay} style={styles.playButton}>
        <Text style={styles.playIcon}>{isPlaying ? "⏸" : "▶"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onNext} style={styles.controlButton}>
        <Text style={styles.controlIcon}>⏭</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sideButton: {
    padding: 12,
    width: 56,
    alignItems: "center",
  },
  sideIcon: {
    fontSize: 22,
  },
  controlButton: {
    padding: 12,
  },
  controlIcon: {
    fontSize: 30,
    color: COLORS.primaryText,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: COLORS.primaryText,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    fontSize: 28,
    color: COLORS.primaryText,
    marginTop: -2,
  },
});

export default Controls;
