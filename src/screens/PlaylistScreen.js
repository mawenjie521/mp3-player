import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image, FlatList } from "react-native";
import { COLORS } from "../data/constants";

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
  listHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  listHeaderTitle: {
    color: COLORS.primaryText,
    fontSize: 22,
    fontWeight: "700",
  },
  listHeaderCount: {
    color: COLORS.secondaryText,
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
    color: COLORS.primaryText,
    fontSize: 16,
  },
  listTitleActive: {
    color: COLORS.accent,
  },
  listArtist: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },
  listActiveIcon: {
    color: COLORS.accent,
    fontSize: 16,
    marginLeft: 8,
  },
  listSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ffffff10",
    marginLeft: 84,
  },
});

export default PlaylistScreen;
