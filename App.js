import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  AppState,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Alert,
  SafeAreaView,
} from "react-native";
import TrackPlayer, {
  usePlaybackState,
  State,
  useProgress,
  Capability,
  IOSCategory,
  IOSCategoryMode,
  IOSCategoryOptions,
} from "react-native-track-player";
import { playlist } from "./src/data/playlist";
import { novels } from "./src/data/novels";
import { filterTracks } from "./src/data/filterTracks";
import { loadJSON, saveJSON } from "./src/data/storage";
import { loadImported, pickAndCopyTrack, persistImported } from "./src/data/importedTracks";
import { COLORS, REPEAT_MAP } from "./src/data/constants";
import PlayerScreen from "./src/screens/PlayerScreen";
import SongsScreen from "./src/screens/SongsScreen";
import NovelsScreen from "./src/screens/NovelsScreen";
import MineScreen from "./src/screens/MineScreen";
import BottomNav from "./src/components/BottomNav";
import ErrorBoundary from "./src/error/ErrorBoundary";

export default function App() {
  const [currentTrack, setCurrentTrack] = useState(null);
  const playbackState = usePlaybackState();
  const { position, duration } = useProgress();
  const [isPlayerInitialized, setIsPlayerInitialized] = useState(false);
  const [initError, setInitError] = useState(null);
  const [repeatMode, setRepeatMode] = useState("off");
  const [view, setView] = useState("tabs");
  const [favorites, setFavorites] = useState([]);
  const [recent, setRecent] = useState([]);
  const [tab, setTab] = useState("songs");
  const [scope, setScope] = useState("songs");
  const [mineSubTab, setMineSubTab] = useState("favorites");
  const [importedTracks, setImportedTracks] = useState([]);
  const allTracks = useMemo(() => [...playlist, ...novels, ...importedTracks], [importedTracks]);

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
    const sub = TrackPlayer.addEventListener("playback-error", (error) => {
      console.error(error)
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
    const sub = TrackPlayer.addEventListener("playback-track-changed", async () => {
      const track = await TrackPlayer.getActiveTrack();
      setCurrentTrack(track);
    });
    return () => sub.remove();
  }, []);

  const playbackRef = useRef(null);
  useEffect(() => {
    playbackRef.current = { currentTrack, tab, scope, repeatMode };
  });

  useEffect(() => {
    if (!currentTrack) return;
    setRecent((prev) => {
      const next = [currentTrack.id, ...prev.filter((id) => id !== currentTrack.id)].slice(0, 20);
      saveJSON("@mp3player:recent", next);
      return next;
    });
  }, [currentTrack?.id]);

  useEffect(() => {
    if (!currentTrack) return;
    let cancelled = false;
    (async () => {
      try {
        const { position } = await TrackPlayer.getProgress();
        if (cancelled) return;
        saveJSON("@mp3player:playback", {
          trackId: currentTrack.id,
          position: position || 0,
          tab,
          scope,
          repeatMode,
        });
      } catch {
        // 静默失败 - 存储不可用不应阻断 UI
      }
    })();
    return () => { cancelled = true; };
  }, [currentTrack?.id, scope, repeatMode]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "inactive" && state !== "background") return;
      const snap = playbackRef.current;
      if (!snap || !snap.currentTrack) return;
      try {
        const { position } = await TrackPlayer.getProgress();
        saveJSON("@mp3player:playback", {
          trackId: snap.currentTrack.id,
          position: position || 0,
          tab: snap.tab,
          scope: snap.scope,
          repeatMode: snap.repeatMode,
        });
      } catch {
        // 静默失败
      }
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
      await TrackPlayer.setupPlayer({
        iosCategory: IOSCategory.Playback,
        iosCategoryMode: IOSCategoryMode.Default,
        iosCategoryOptions: [
          IOSCategoryOptions.AllowBluetoothA2DP,
          IOSCategoryOptions.AllowAirPlay,
          IOSCategoryOptions.DefaultToSpeaker,
        ],
      });
      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
        ],
      });
      await TrackPlayer.add(playlist);

      const [imported, savedFavs, savedRecent, savedPlayback] = await Promise.all([
        loadImported(),
        loadJSON("@mp3player:favorites", []),
        loadJSON("@mp3player:recent", []),
        loadJSON("@mp3player:playback", null),
      ]);

      setImportedTracks(imported);
      setFavorites(savedFavs);
      setRecent(savedRecent);
      if (imported.length > 0) await TrackPlayer.add(imported);

      if (savedPlayback && savedPlayback.trackId) {
        const { trackId, position, repeatMode: savedRepeat } = savedPlayback;
        const safeRepeat = REPEAT_MAP[savedRepeat] ? savedRepeat : "off";

        let savedTab;
        let savedScope;
        if (typeof savedPlayback.activeTab === "string") {
          const map = {
            all: { tab: "songs", scope: "songs" },
            favorites: { tab: "mine", scope: "favorites" },
            recent: { tab: "mine", scope: "recent" },
            imported: { tab: "mine", scope: "imported" },
          };
          const mapped = map[savedPlayback.activeTab] || { tab: "songs", scope: "songs" };
          savedTab = mapped.tab;
          savedScope = mapped.scope;
        } else {
          savedTab = ["songs", "novels", "mine"].includes(savedPlayback.tab) ? savedPlayback.tab : "songs";
          savedScope = ["songs", "novels", "favorites", "recent", "imported"].includes(savedPlayback.scope) ? savedPlayback.scope : "songs";
        }

        setRepeatMode(safeRepeat);
        await TrackPlayer.setRepeatMode(REPEAT_MAP[safeRepeat]);
        setTab(savedTab);
        setScope(savedScope);
        if (["favorites", "recent", "imported"].includes(savedScope)) {
          setMineSubTab(savedScope);
        }

        const allTracksForRestore = [...playlist, ...novels, ...imported];
        const filtered = filterTracks(savedScope, allTracksForRestore, savedFavs, savedRecent);
        await TrackPlayer.setQueue(filtered);
        const idx = filtered.findIndex((t) => t.id === trackId);
        if (idx >= 0) {
          await TrackPlayer.skip(idx);
          if (typeof position === "number" && position > 0) {
            await TrackPlayer.seekTo(position);
          }
          const track = await TrackPlayer.getActiveTrack();
          setCurrentTrack(track);
        }
      } else {
        await TrackPlayer.setRepeatMode(REPEAT_MAP.off);
      }

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

  const onSelect = async (item, tracks, scopeKey) => {
    await TrackPlayer.setQueue(tracks);
    const index = tracks.findIndex((t) => t.id === item.id);
    await TrackPlayer.skip(index);
    await TrackPlayer.play();
    const track = await TrackPlayer.getActiveTrack();
    setCurrentTrack(track);
    setScope(scopeKey);
    setView("player");
  };

  const onBack = () => {
    setView("tabs");
  };

  const onShowPlayer = () => setView("player");

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveJSON("@mp3player:favorites", next);
      return next;
    });
  };

  const handleImport = async () => {
    try {
      const track = await pickAndCopyTrack();
      setImportedTracks((prev) => {
        const next = [...prev, track];
        persistImported(next);
        return next;
      });
      await TrackPlayer.add([track]);
    } catch (e) {
      const msg = (e && e.message) || "";
      if (msg.includes("cancel") || msg.includes("Cancel")) return;
      Alert.alert("导入失败", "无法导入此文件");
    }
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
  } else if (view === "player") {
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
  } else {
    content = (
      <SafeAreaView style={styles.container}>
        <View style={styles.glowTop} />
        <View style={{ flex: 1 }}>
          {tab === "songs" && (
            <SongsScreen
              currentTrack={currentTrack}
              onSelect={onSelect}
              onShowPlayer={onShowPlayer}
            />
          )}
          {tab === "novels" && (
            <NovelsScreen
              currentTrack={currentTrack}
              onSelect={onSelect}
              onShowPlayer={onShowPlayer}
            />
          )}
          {tab === "mine" && (
            <MineScreen
              allTracks={allTracks}
              currentTrack={currentTrack}
              onSelect={onSelect}
              onShowPlayer={onShowPlayer}
              favorites={favorites}
              recent={recent}
              onImport={handleImport}
              mineSubTab={mineSubTab}
              onSubTabChange={setMineSubTab}
            />
          )}
        </View>
        <BottomNav activeTab={tab} onChange={setTab} />
      </SafeAreaView>
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
