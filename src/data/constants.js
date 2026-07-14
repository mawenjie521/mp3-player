import { Dimensions } from "react-native";
import { RepeatMode } from "react-native-track-player";

export const SCREEN_WIDTH = Dimensions.get("window").width;

// Kept until Vinyl.js is deleted in Task 9.
export const VINYL_SIZE = Math.min(340, SCREEN_WIDTH - 48);
export const ART_SIZE = Math.min(220, VINYL_SIZE - 120);

export const PLAYER_COVER_SIZE_SONG = 280;
export const PLAYER_COVER_SIZE_NOVEL = 240;

export const COLORS = {
  background:    "#FAF7F2",
  surface:       "#FFFFFF",
  separator:     "#0000000F",
  primaryText:   "#1A1A1A",
  secondaryText: "#8A8A8E",
  tertiaryText:  "#B5B5B8",
  accent:        "#C20C0C",
  accentNovel:   "#F86442",
  playerText:    "#FFFFFF",
  playerTextDim: "#FFFFFF99",
};

export const TYPO = {
  titleLarge:  { fontSize: 28, fontWeight: "700" },
  titleMedium: { fontSize: 17, fontWeight: "600" },
  body:        { fontSize: 15, fontWeight: "600" },
  caption:     { fontSize: 12, fontWeight: "400" },
  micro:       { fontSize: 10, fontWeight: "600" },
};

export const REPEAT_MAP = {
  off: RepeatMode.Off,
  queue: RepeatMode.Queue,
  track: RepeatMode.Track,
};

export const NAV_TABS = [
  { key: "songs", label: "歌曲", icon: "♫" },
  { key: "novels", label: "小说", icon: "▤" },
  { key: "mine", label: "我的", icon: "☻" },
];

export const APP_VERSION = "1.0.0";
