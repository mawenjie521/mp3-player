import React from "react";
import { View, Animated, Image, StyleSheet } from "react-native";
import { VINYL_SIZE, ART_SIZE, COLORS } from "../data/constants";

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

const styles = StyleSheet.create({
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
    backgroundColor: COLORS.vinyl,
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
    borderColor: COLORS.groove,
  },
  artWrapper: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: ART_SIZE / 2,
    borderWidth: 2,
    borderColor: COLORS.primaryText,
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
    backgroundColor: COLORS.accent,
  },
});

export default Vinyl;
