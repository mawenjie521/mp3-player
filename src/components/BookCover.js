import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";

function BookCover({ uri, title, style, accentColor = COLORS.accent }) {
  if (uri) {
    return <Image source={{ uri }} style={style} />;
  }
  const initial = (title || "?").trim().charAt(0) || "?";
  return (
    <View style={[style, styles.placeholder, { backgroundColor: accentColor }]}>
      <Text style={styles.placeholderText}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: COLORS.surface,
    fontSize: 20,
    fontWeight: "600",
  },
});

export default BookCover;
