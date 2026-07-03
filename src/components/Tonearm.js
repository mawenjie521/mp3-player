import React, { useEffect, useRef } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";

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

const styles = StyleSheet.create({
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
});

export default Tonearm;
