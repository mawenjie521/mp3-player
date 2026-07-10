import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";

function OcrImportScreen({ onComplete, onCancel }) {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>OCR 导入向导（待实现）</Text>
      <TouchableOpacity onPress={onCancel} style={styles.btn}>
        <Text style={styles.btnText}>返回</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  placeholder: { color: COLORS.primaryText, fontSize: 16, marginBottom: 24 },
  btn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: COLORS.accent },
  btnText: { color: COLORS.accent, fontSize: 14 },
});

export default OcrImportScreen;
