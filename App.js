import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Animated,
  Easing,
  FlatList,
  Alert,
} from "react-native";
import Slider from "@react-native-community/slider";
import TrackPlayer, { usePlaybackState, State, useProgress } from "react-native-track-player";
import { playlist } from "./src/data/playlist";
import { COLORS, REPEAT_MAP } from "./src/data/constants";
import Vinyl from "./src/components/Vinyl";
import Tonearm from "./src/components/Tonearm";
import Lyrics from "./src/components/Lyrics";
import Controls from "./src/components/Controls";

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
  const lyricIndex = useMemo(() => {
    if (!currentTrack || !currentTrack.lyrics || !duration) return 0;
    const idx = Math.floor((position / duration) * currentTrack.lyrics.length);
    return Math.min(idx, currentTrack.lyrics.length - 1);
  }, [position, duration, currentTrack]);

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

      <Lyrics lines={currentTrack.lyrics || []} currentIndex={lyricIndex} />

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration}
        value={position}
        onSlidingComplete={onSeek}
        minimumTrackTintColor="#C20C0C"
        maximumTrackTintColor="#ffffff20"
        thumbTintColor="#ffffff"
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

function PlaylistScreen({ playlist, currentTrack, onSelect }) {
  const renderItem = ({ item, index }) => {
    const isActive = currentTrack && item.id === currentTrack.id;
    return (
      <TouchableOpacity
        style={styles.listRow}
        onPress={() => onSelect(index)}
        activeOpacity={0.6}
      >
        <Image source={{ uri: item.artwork }} style={styles.listThumb} />
        <View style={styles.listInfo}>
          <Text
            style={[styles.listTitle, isActive && styles.listTitleActive]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={styles.listArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        {isActive && <Text style={styles.listActiveIcon}>▶</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.glowTop} />
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>播放列表</Text>
        <Text style={styles.listHeaderCount}>共 {playlist.length} 首</Text>
      </View>
      <FlatList
        data={playlist}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
      />
    </SafeAreaView>
  );
}

export default function App() {
  const [currentTrack, setCurrentTrack] = useState(null);
  const playbackState = usePlaybackState();
  const { position, duration } = useProgress();
  const [isPlayerInitialized, setIsPlayerInitialized] = useState(false);
  const [initError, setInitError] = useState(null);
  const [repeatMode, setRepeatMode] = useState("off");
  const [view, setView] = useState("list");

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

  if (initError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>加载失败</Text>
        <Text style={styles.errorMessage}>{initError}</Text>
        <TouchableOpacity onPress={retryInit} style={styles.retryButton}>
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isPlayerInitialized) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>加载中...</Text>
      </View>
    );
  }

  if (view === "list") {
    return (
      <PlaylistScreen
        playlist={playlist}
        currentTrack={currentTrack}
        onSelect={onSelect}
      />
    );
  }

  return (
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
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  glowTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: "#C20C0C",
    opacity: 0.05,
  },
  loading: {
    color: "#fff",
    textAlign: "center",
    marginTop: 100,
  },
  errorTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 120,
  },
  errorMessage: {
    color: "#b3b3b3",
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
    borderColor: "#C20C0C",
    alignSelf: "center",
  },
  retryText: {
    color: "#C20C0C",
    fontSize: 15,
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
    color: "#fff",
  },
  topTitle: {
    flex: 1,
    fontSize: 15,
    color: "#fff",
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
    color: "#b3b3b3",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  listHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  listHeaderTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  listHeaderCount: {
    color: "#b3b3b3",
    fontSize: 13,
    marginTop: 4,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  listThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: "#333",
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listTitle: {
    color: "#fff",
    fontSize: 16,
  },
  listTitleActive: {
    color: "#C20C0C",
  },
  listArtist: {
    color: "#b3b3b3",
    fontSize: 13,
    marginTop: 2,
  },
  listActiveIcon: {
    color: "#C20C0C",
    fontSize: 16,
    marginLeft: 8,
  },
  listSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ffffff10",
    marginLeft: 84,
  },
});
