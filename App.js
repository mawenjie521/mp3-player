import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Alert,
} from "react-native";
import TrackPlayer, { usePlaybackState, State, useProgress } from "react-native-track-player";
import { playlist } from "./src/data/playlist";
import { loadJSON, saveJSON } from "./src/data/storage";
import { COLORS, REPEAT_MAP } from "./src/data/constants";
import PlayerScreen from "./src/screens/PlayerScreen";
import PlaylistScreen from "./src/screens/PlaylistScreen";
import ErrorBoundary from "./src/error/ErrorBoundary";

export default function App() {
  const [currentTrack, setCurrentTrack] = useState(null);
  const playbackState = usePlaybackState();
  const { position, duration } = useProgress();
  const [isPlayerInitialized, setIsPlayerInitialized] = useState(false);
  const [initError, setInitError] = useState(null);
  const [repeatMode, setRepeatMode] = useState("off");
  const [view, setView] = useState("list");
  const [favorites, setFavorites] = useState([]);
  const [recent, setRecent] = useState([]);

  const spin = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(null);

  const isPlaying = playbackState.state === State.Playing;

  useEffect(() => {
    initPlayer();
    return () => TrackPlayer.reset();
  }, []);

  useEffect(() => {
    if (isPlaying) {
      startSpin();
    } else {
      stopSpin();
    }
  }, [isPlaying]);

  useEffect(() => {
    const sub = TrackPlayer.addEventListener("playback-error", () => {
      Alert.alert(
        "播放失败",
        "当前歌曲无法播放，是否跳到下一首？",
        [
          { text: "下一首", onPress: () => skipToNext() },
          { text: "取消", style: "cancel" },
        ]
      );
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    loadJSON("@mp3player:favorites", []).then(setFavorites);
  }, []);

  useEffect(() => {
    loadJSON("@mp3player:recent", []).then(setRecent);
  }, []);

  useEffect(() => {
    if (!currentTrack) return;
    setRecent((prev) => {
      const next = [currentTrack.id, ...prev.filter((id) => id !== currentTrack.id)].slice(0, 20);
      saveJSON("@mp3player:recent", next);
      return next;
    });
  }, [currentTrack?.id]);

  const startSpin = () => {
    if (spinAnim.current) return;
    const anim = Animated.loop(
      Animated.timing(spin, {
        toValue: spin._value + 360,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      { resetOnStart: false }
    );
    spinAnim.current = anim;
    anim.start();
  };

  const stopSpin = () => {
    if (spinAnim.current) {
      spinAnim.current.stop();
      spinAnim.current = null;
    }
  };

  const initPlayer = async () => {
    try {
      await TrackPlayer.setupPlayer();
      await TrackPlayer.add(playlist);
      await TrackPlayer.setRepeatMode(REPEAT_MAP.off);
      setIsPlayerInitialized(true);
    } catch (e) {
      setInitError((e && e.message) || "播放器初始化失败");
    }
  };

  const retryInit = () => {
    setInitError(null);
    initPlayer();
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => {
      const next = prev === "off" ? "queue" : prev === "queue" ? "track" : "off";
      TrackPlayer.setRepeatMode(REPEAT_MAP[next]);
      return next;
    });
  };

  const togglePlayback = async () => {
    if (!currentTrack) return;
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  };

  const skipToNext = async () => {
    try {
      await TrackPlayer.skipToNext();
      const track = await TrackPlayer.getActiveTrack();
      setCurrentTrack(track);
    } catch (e) {
      // Queue boundary (repeatMode=off at last track) — silently ignore.
    }
  };

  const skipToPrevious = async () => {
    try {
      await TrackPlayer.skipToPrevious();
      const track = await TrackPlayer.getActiveTrack();
      setCurrentTrack(track);
    } catch (e) {
      // Queue boundary (at first track) — silently ignore.
    }
  };

  const seekTo = async (value) => {
    await TrackPlayer.seekTo(value);
  };

  const onSelect = async (index) => {
    await TrackPlayer.skip(index);
    await TrackPlayer.play();
    const track = await TrackPlayer.getActiveTrack();
    setCurrentTrack(track);
    setView("player");
  };

  const onBack = () => {
    setView("list");
  };

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveJSON("@mp3player:favorites", next);
      return next;
    });
  };

  let content;
  if (initError) {
    content = (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>加载失败</Text>
        <Text style={styles.errorMessage}>{initError}</Text>
        <TouchableOpacity onPress={retryInit} style={styles.retryButton}>
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (!isPlayerInitialized) {
    content = (
      <View style={styles.container}>
        <Text style={styles.loading}>加载中...</Text>
      </View>
    );
  } else if (view === "list") {
    content = (
      <PlaylistScreen
        playlist={playlist}
        currentTrack={currentTrack}
        onSelect={onSelect}
      />
    );
  } else {
    content = (
      <PlayerScreen
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        position={position}
        duration={duration}
        repeatMode={repeatMode}
        spin={spin}
        onTogglePlay={togglePlayback}
        onSkipNext={skipToNext}
        onSkipPrev={skipToPrevious}
        onSeek={seekTo}
        onToggleRepeat={toggleRepeat}
        onBack={onBack}
        isFavorite={favorites.includes(currentTrack?.id)}
        onToggleFavorite={toggleFavorite}
      />
    );
  }

  return <ErrorBoundary>{content}</ErrorBoundary>;
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
  errorTitle: {
    color: COLORS.primaryText,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 120,
  },
  errorMessage: {
    color: COLORS.secondaryText,
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    marginHorizontal: 32,
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignSelf: "center",
  },
  retryText: {
    color: COLORS.accent,
    fontSize: 15,
  },
});
