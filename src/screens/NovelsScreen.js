import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";
import { novels } from "../data/novels";
import TrackList from "../components/TrackList";

function NovelsScreen({ currentTrack, onSelect, onShowPlayer }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>小说</Text>
        <Text style={styles.subtitle}>共 {novels.length} 本</Text>
      </View>
      <TrackList
        tracks={novels}
        currentTrack={currentTrack}
        onSelect={(item) => onSelect(item, novels, "novels")}
        onShowPlayer={onShowPlayer}
        emptyText="还没有有声书"
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

export default NovelsScreen;
