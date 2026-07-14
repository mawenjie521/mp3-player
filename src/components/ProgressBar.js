import React, { useState, useRef } from "react";
import { View, Text, PanResponder, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function ProgressBar({ position, duration, onSeek, accentColor = COLORS.accent }) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const containerWidth = useRef(0);

  const safeDuration = Math.max(duration || 0, 1);
  const displayValue = isDragging
    ? dragValue
    : Math.min(position, safeDuration);
  const progress = Math.max(0, Math.min(1, displayValue / safeDuration));

  const updateValueFromTouchX = (x) => {
    const width = containerWidth.current || 1;
    const ratio = Math.max(0, Math.min(1, x / width));
    const value = ratio * safeDuration;
    setDragValue(value);
    return value;
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      setDragValue(position);
      setIsDragging(true);
      updateValueFromTouchX(evt.nativeEvent.locationX);
    },
    onPanResponderMove: (evt) => {
      updateValueFromTouchX(evt.nativeEvent.locationX);
    },
    onPanResponderRelease: (evt) => {
      const v = updateValueFromTouchX(evt.nativeEvent.locationX);
      onSeek(v);
      setIsDragging(false);
    },
    onPanResponderTerminate: () => {
      setIsDragging(false);
    },
  });

  return (
    <View style={styles.wrapper}>
      <View
        style={styles.touchContainer}
        onLayout={(e) => {
          containerWidth.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
      >
        <View style={styles.trackBackground} />
        <View style={[styles.trackFill, { width: `${progress * 100}%`, backgroundColor: accentColor }]} />
        <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
      </View>
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
    paddingHorizontal: 24,
  },
  touchContainer: {
    width: "100%",
    height: 40,
    position: "relative",
  },
  trackBackground: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 17,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.playerTextDim,
  },
  trackFill: {
    position: "absolute",
    left: 0,
    top: 17,
    height: 6,
    borderRadius: 3,
  },
  thumb: {
    position: "absolute",
    top: 12,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.playerText,
    marginLeft: -8,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  time: {
    color: COLORS.playerTextDim,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
});

export default ProgressBar;
