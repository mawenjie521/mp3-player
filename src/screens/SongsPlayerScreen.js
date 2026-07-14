import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ImageBackground, Image, Animated } from "react-native";
import { COLORS, PLAYER_COVER_SIZE_SONG } from "../data/constants";
import Lyrics from "../components/Lyrics";
import Controls from "../components/Controls";
import ProgressBar from "../components/ProgressBar";

function SongsPlayerScreen({
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

  const spinDeg = spin.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: currentTrack.artwork }}
        style={StyleSheet.absoluteFill}
        blurRadius={80}
      >
        <View style={styles.overlay} />
      </ImageBackground>

      <SafeAreaView style={styles.foreground} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onBack} style={styles.topBtn}>
            <Text style={styles.topIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>{currentTrack.title}</Text>
          <TouchableOpacity onPress={() => onToggleFavorite(currentTrack.id)} style={styles.topBtn}>
            <Text style={styles.topIcon}>{isFavorite ? "♥" : "♡"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.coverStage}>
          <Animated.View style={[styles.coverWrap, { transform: [{ rotate: spinDeg }] }]}>
            <Image source={{ uri: currentTrack.artwork }} style={styles.cover} />
          </Animated.View>
        </View>

        <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>

        <Lyrics lrc={currentTrack.lrc} position={position} />

        <ProgressBar position={position} duration={duration} onSeek={onSeek} accentColor={COLORS.accent} />

        <Controls
          isPlaying={isPlaying}
          onPrev={onSkipPrev}
          onNext={onSkipNext}
          onTogglePlay={onTogglePlay}
          repeatMode={repeatMode}
          onToggleRepeat={onToggleRepeat}
          accentColor={COLORS.accent}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  foreground: {
    flex: 1,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topIcon: {
    color: COLORS.playerText,
    fontSize: 24,
  },
  topTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.playerText,
    textAlign: "center",
    marginHorizontal: 8,
  },
  coverStage: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  coverWrap: {
    width: PLAYER_COVER_SIZE_SONG,
    height: PLAYER_COVER_SIZE_SONG,
  },
  cover: {
    width: "100%",
    height: "100%",
    borderRadius: PLAYER_COVER_SIZE_SONG / 2,
  },
  artist: {
    color: COLORS.playerTextDim,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
});

export default SongsPlayerScreen;
