import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, TYPO } from "../data/constants";
import { playlist } from "../data/playlist";
import TrackList from "../components/TrackList";

function SongsScreen({ currentTrack, onSelect }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, TYPO.titleLarge]}>歌曲</Text>
        <Text style={[styles.subtitle, TYPO.caption]}>{playlist.length} 首</Text>
      </View>
      <TrackList
        tracks={playlist}
        currentTrack={currentTrack}
        onSelect={(item) => onSelect(item, playlist, "songs")}
        emptyText="还没有歌曲"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  subtitle: {
    color: COLORS.secondaryText,
    marginTop: 4,
  },
});

export default SongsScreen;
