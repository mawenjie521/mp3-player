import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ImageBackground, Image } from "react-native";
import { COLORS, PLAYER_COVER_SIZE_NOVEL } from "../data/constants";
import Controls from "../components/Controls";
import ProgressBar from "../components/ProgressBar";

function NovelsPlayerScreen({
  currentTrack,
  isPlaying,
  position,
  duration,
  repeatMode,
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
        <Text style={styles.loading}>请选择章节</Text>
      </View>
    );
  }

  const chapterIndex = currentTrack.chapterIndex || 0;
  const totalChapters = currentTrack.totalChapters || 1;
  const bookTitle = currentTrack.bookTitle || currentTrack.artist || "";

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
          <Image source={{ uri: currentTrack.artwork }} style={styles.cover} />
        </View>

        <Text style={styles.bookTitle} numberOfLines={1}>{bookTitle}</Text>
        <Text style={styles.chapterProgress}>第{chapterIndex + 1}章 / 共{totalChapters}章</Text>

        <View style={styles.spacer} />

        <ProgressBar position={position} duration={duration} onSeek={onSeek} accentColor={COLORS.accentNovel} />

        <Controls
          isPlaying={isPlaying}
          onPrev={onSkipPrev}
          onNext={onSkipNext}
          onTogglePlay={onTogglePlay}
          repeatMode={repeatMode}
          onToggleRepeat={onToggleRepeat}
          accentColor={COLORS.accentNovel}
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
    marginTop: 24,
    marginBottom: 20,
  },
  cover: {
    width: PLAYER_COVER_SIZE_NOVEL,
    height: PLAYER_COVER_SIZE_NOVEL,
    borderRadius: 12,
  },
  bookTitle: {
    color: COLORS.playerText,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  chapterProgress: {
    color: COLORS.playerTextDim,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 16,
  },
  spacer: {
    flex: 1,
  },
});

export default NovelsPlayerScreen;
