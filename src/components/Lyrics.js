import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";
import { parseLRC, findCurrentIndex } from "../data/lrcParser";

function Lyrics({ lrc, position }) {
  const parsed = useMemo(() => parseLRC(lrc), [lrc]);
  const currentIndex = useMemo(() => findCurrentIndex(parsed, position), [parsed, position]);

  if (parsed.length === 0) {
    return (
      <View style={styles.lyricsContainer}>
        <Text style={styles.emptyText}>暂无歌词</Text>
      </View>
    );
  }

  const visible = [];
  for (let i = -1; i <= 1; i++) {
    const idx = currentIndex + i;
    if (idx >= 0 && idx < parsed.length) {
      visible.push({ idx, text: parsed[idx].text });
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
  emptyText: {
    color: COLORS.secondaryText,
    fontSize: 14,
  },
});

export default Lyrics;
