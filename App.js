import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Dimensions,
  Animated,
  Easing,
  FlatList,
  Alert,
} from "react-native";
import Slider from "@react-native-community/slider";
import TrackPlayer, { usePlaybackState, State, useProgress, RepeatMode } from "react-native-track-player";

const playlist = [
  {
    id: "1",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    title: "示例音乐 1",
    artist: "SoundHelix",
    artwork: "https://picsum.photos/seed/song1/600/600",
    lyrics: [
      "夜色温柔如水",
      "音符在指尖流淌",
      "回忆像风一样",
      "吹过空荡的街",
      "我们都在追寻",
      "那一束微光",
      "时间停在原地",
      "听一首老歌",
    ],
  },
  {
    id: "2",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    title: "示例音乐 2",
    artist: "SoundHelix",
    artwork: "https://picsum.photos/seed/song2/600/600",
    lyrics: [
      "月光洒在窗台",
      "心事无处安放",
      "远处灯火阑珊",
      "谁在轻声哼唱",
      "走过多少旅程",
      "才学会遗忘",
      "梦里有你的脸",
      "醒来只剩空",
    ],
  },
  {
    id: "3",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    title: "示例音乐 3",
    artist: "SoundHelix",
    artwork: "https://picsum.photos/seed/song3/600/600",
    lyrics: [
      "雨滴敲打屋檐",
      "节奏像心跳声",
      "城市在沉睡中",
      "独自闪烁霓虹",
      "每一段旋律里",
      "藏着旧时光",
      "让音乐带我们",
      "回到那一年",
    ],
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const VINYL_SIZE = Math.min(340, SCREEN_WIDTH - 48);
const ART_SIZE = Math.min(220, VINYL_SIZE - 120);

const REPEAT_MAP = {
  off: RepeatMode.Off,
  queue: RepeatMode.Queue,
  track: RepeatMode.Track,
};

function Vinyl({ artwork, spin }) {
  const spinDeg = spin.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.vinylWrapper}>
      <Animated.View style={[styles.vinyl, { transform: [{ rotate: spinDeg }] }]}>
        <View style={[styles.groove, { width: VINYL_SIZE - 20, height: VINYL_SIZE - 20, borderRadius: (VINYL_SIZE - 20) / 2 }]} />
        <View style={[styles.groove, { width: VINYL_SIZE - 60, height: VINYL_SIZE - 60, borderRadius: (VINYL_SIZE - 60) / 2 }]} />
        <View style={[styles.groove, { width: VINYL_SIZE - 100, height: VINYL_SIZE - 100, borderRadius: (VINYL_SIZE - 100) / 2 }]} />
        <View style={styles.artWrapper}>
          <Image source={{ uri: artwork }} style={styles.art} />
          <View style={styles.centerLabel} />
        </View>
      </Animated.View>
    </View>
  );
}

function Tonearm({ isPlaying }) {
  const angle = useRef(new Animated.Value(isPlaying ? 20 : -30)).current;

  useEffect(() => {
    Animated.timing(angle, {
      toValue: isPlaying ? 20 : -30,
      duration: 400,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [isPlaying, angle]);

  const rot = angle.interpolate({
    inputRange: [-30, 20],
    outputRange: ["-30deg", "20deg"],
  });

  return (
    <Animated.View style={[styles.tonearm, { transform: [{ rotate: rot }] }]}>
      <View style={styles.tonearmBar} />
      <View style={styles.tonearmHead} />
    </Animated.View>
  );
}

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

function Controls({ isPlaying, onPrev, onNext, onTogglePlay, repeatMode, onToggleRepeat }) {
  const accent = (on) => (on ? "#C20C0C" : "#b3b3b3");
  const repeatIcon = repeatMode === "track" ? "🔂" : "🔁";

  return (
    <View style={styles.controls}>
      <TouchableOpacity onPress={onToggleRepeat} style={styles.sideButton}>
        <Text style={[styles.sideIcon, { color: accent(repeatMode !== "off") }]}>{repeatIcon}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onPrev} style={styles.controlButton}>
        <Text style={styles.controlIcon}>⏮</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onTogglePlay} style={styles.playButton}>
        <Text style={styles.playIcon}>{isPlaying ? "⏸" : "▶"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onNext} style={styles.controlButton}>
        <Text style={styles.controlIcon}>⏭</Text>
      </TouchableOpacity>
    </View>
  );
}

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
    await TrackPlayer.setupPlayer();
    await TrackPlayer.add(playlist);
    await TrackPlayer.setRepeatMode(REPEAT_MAP.off);
    setIsPlayerInitialized(true);
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
    await TrackPlayer.skipToNext();
    const track = await TrackPlayer.getActiveTrack();
    setCurrentTrack(track);
  };

  const skipToPrevious = async () => {
    await TrackPlayer.skipToPrevious();
    const track = await TrackPlayer.getActiveTrack();
    setCurrentTrack(track);
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
  vinylWrapper: {
    width: VINYL_SIZE,
    height: VINYL_SIZE,
    alignSelf: "center",
    marginBottom: 24,
  },
  vinyl: {
    width: VINYL_SIZE,
    height: VINYL_SIZE,
    borderRadius: VINYL_SIZE / 2,
    backgroundColor: "#0a0a0a",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  groove: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "#222",
  },
  artWrapper: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: ART_SIZE / 2,
    borderWidth: 2,
    borderColor: "#fff",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  art: {
    width: "100%",
    height: "100%",
    borderRadius: ART_SIZE / 2,
  },
  centerLabel: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#C20C0C",
  },
  tonearm: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 130,
    height: 130,
    zIndex: 10,
  },
  tonearmBar: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 8,
    height: 100,
    borderRadius: 4,
    backgroundColor: "#999",
    transformOrigin: "top right",
  },
  tonearmHead: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#666",
    borderWidth: 2,
    borderColor: "#888",
  },
  lyricsContainer: {
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 24,
    marginBottom: 16,
  },
  lyricLine: {
    fontSize: 14,
    color: "#b3b3b3",
    opacity: 0.4,
    marginVertical: 4,
    textAlign: "center",
  },
  lyricCurrent: {
    fontSize: 17,
    color: "#ffffff",
    opacity: 1,
    fontWeight: "600",
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
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sideButton: {
    padding: 12,
    width: 56,
    alignItems: "center",
  },
  sideIcon: {
    fontSize: 22,
  },
  controlButton: {
    padding: 12,
  },
  controlIcon: {
    fontSize: 30,
    color: "#fff",
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    fontSize: 28,
    color: "#fff",
    marginTop: -2,
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
