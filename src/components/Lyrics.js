import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";

function Lyrics({ lines, currentIndex }) {
  const visible = [];
  for (let i = -1; i <= 1; i++) {
    const idx = currentIndex + i;
    if (idx >= 0 && idx < lines.length) {
      visible.push({ idx, text: lines[idx] });
    }
  }

  return (
    <View style={styles.lyricsContainer}>
      {visible.map(({ idx, text }) => {
        const isCurrent = idx === currentIndex;
        return (
          <Text key={idx} style={[styles.lyricLine, isCurrent && styles.lyricCurrent]} numberOfLines={1}>
            {text}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lyricsContainer: {
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 24,
    marginBottom: 16,
  },
  lyricLine: {
    fontSize: 14,
    color: COLORS.secondaryText,
    opacity: 0.4,
    marginVertical: 4,
    textAlign: "center",
  },
  lyricCurrent: {
    fontSize: 17,
    color: COLORS.primaryText,
    opacity: 1,
    fontWeight: "600",
  },
});

export default Lyrics;
