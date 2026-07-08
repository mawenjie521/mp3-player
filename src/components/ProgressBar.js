import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import { COLORS } from "../data/constants";

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function ProgressBar({ position, duration, onSeek }) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);

  const safeDuration = Math.max(duration || 0, 1);
  const displayValue = isDragging
    ? dragValue
    : Math.min(position, safeDuration);

  return (
    <View style={styles.wrapper}>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={safeDuration}
        value={displayValue}
        onSlidingStart={() => {
          setDragValue(position);
          setIsDragging(true);
        }}
        onValueChange={(v) => setDragValue(v)}
        onSlidingComplete={(v) => {
          onSeek(v);
          setIsDragging(false);
        }}
        minimumTrackTintColor={COLORS.accent}
        maximumTrackTintColor="#ffffff20"
        thumbTintColor={COLORS.primaryText}
      />
      <View style={styles.timeContainer}>
        <Text style={styles.time}>{formatTime(displayValue)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  time: {
    color: COLORS.secondaryText,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
});

export default ProgressBar;
