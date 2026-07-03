import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import Slider from "@react-native-community/slider";
import { COLORS } from "../data/constants";
import Vinyl from "../components/Vinyl";
import Tonearm from "../components/Tonearm";
import Lyrics from "../components/Lyrics";
import Controls from "../components/Controls";

function PlayerScreen({
  currentTrack,
  isPlaying,
  position,
  duration,
  repeatMode,
  spin,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
  onSeek,
  onToggleRepeat,
  onBack,
}) {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (!currentTrack) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>请选择歌曲</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.glowTop} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.topBackButton}>
          <Text style={styles.topIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{currentTrack.title}</Text>
        <Text style={styles.topIcon}>⤴</Text>
      </View>

      <View style={styles.vinylStage}>
        <Vinyl artwork={currentTrack.artwork} spin={spin} />
        <Tonearm isPlaying={isPlaying} />
      </View>

      <Lyrics lrc={currentTrack.lrc} position={position} />

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration}
        value={position}
        onSlidingComplete={onSeek}
        minimumTrackTintColor={COLORS.accent}
        maximumTrackTintColor="#ffffff20"
        thumbTintColor={COLORS.primaryText}
      />
      <View style={styles.timeContainer}>
        <Text style={styles.time}>{formatTime(position)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>

      <Controls
        isPlaying={isPlaying}
        onPrev={onSkipPrev}
        onNext={onSkipNext}
        onTogglePlay={onTogglePlay}
        repeatMode={repeatMode}
        onToggleRepeat={onToggleRepeat}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  glowTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: COLORS.accent,
    opacity: 0.05,
  },
  loading: {
    color: COLORS.primaryText,
    textAlign: "center",
    marginTop: 100,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 16,
  },
  topBackButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  topIcon: {
    fontSize: 24,
    color: COLORS.primaryText,
  },
  topTitle: {
    flex: 1,
    fontSize: 15,
    color: COLORS.primaryText,
    textAlign: "center",
    marginHorizontal: 16,
  },
  vinylStage: {
    position: "relative",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
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

export default PlayerScreen;
