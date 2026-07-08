import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { COLORS } from "../data/constants";
import Vinyl from "../components/Vinyl";
import Tonearm from "../components/Tonearm";
import Lyrics from "../components/Lyrics";
import Controls from "../components/Controls";
import ProgressBar from "../components/ProgressBar";

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
  isFavorite,
  onToggleFavorite,
}) {
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
        <TouchableOpacity onPress={() => onToggleFavorite(currentTrack.id)} style={styles.topBackButton}>
          <Text style={[styles.topIcon, { color: isFavorite ? COLORS.accent : COLORS.secondaryText }]}>
            {isFavorite ? "♥" : "♡"}
          </Text>
        </TouchableOpacity>
        <Text style={styles.topIcon}>⤴</Text>
      </View>

      <View style={styles.vinylStage}>
        <Vinyl artwork={currentTrack.artwork} spin={spin} />
        <Tonearm isPlaying={isPlaying} />
      </View>

      <Lyrics lrc={currentTrack.lrc} position={position} />

      <ProgressBar position={position} duration={duration} onSeek={onSeek} />

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
});

export default PlayerScreen;
