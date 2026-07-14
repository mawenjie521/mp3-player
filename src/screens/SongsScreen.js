import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";
import { playlist } from "../data/playlist";
import TrackList from "../components/TrackList";

function SongsScreen({ currentTrack, onSelect }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>歌曲</Text>
        <Text style={styles.subtitle}>共 {playlist.length} 首</Text>
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
  title: {
    color: COLORS.primaryText,
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 4,
  },
});

export default SongsScreen;
