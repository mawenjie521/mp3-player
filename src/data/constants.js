import { Dimensions } from "react-native";
import { RepeatMode } from "react-native-track-player";

export const SCREEN_WIDTH = Dimensions.get("window").width;

export const VINYL_SIZE = Math.min(340, SCREEN_WIDTH - 48);
export const ART_SIZE = Math.min(220, VINYL_SIZE - 120);

export const COLORS = {
  background: "#1a1a1a",
  accent: "#C20C0C",
  primaryText: "#ffffff",
  secondaryText: "#b3b3b3",
  vinyl: "#0a0a0a",
  groove: "#222",
};

export const REPEAT_MAP = {
  off: RepeatMode.Off,
  queue: RepeatMode.Queue,
  track: RepeatMode.Track,
};
