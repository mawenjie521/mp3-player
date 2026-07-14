import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert } from "react-native";
import { COLORS, TYPO, APP_VERSION } from "../data/constants";

function SettingsScreen({ onBack, onClearCache }) {
  const handleClearCache = () => {
    Alert.alert(
      "清除缓存",
      "将删除所有 OCR 小说、导入音乐和播放记录，确定继续？",
      [
        { text: "取消", style: "cancel" },
        {
          text: "清除",
          style: "destructive",
          onPress: () => onClearCache(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Text style={styles.headerIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, TYPO.titleMedium]}>设置</Text>
        <View style={styles.headerBtn} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list}>
        <TouchableOpacity style={styles.row} onPress={handleClearCache}>
          <Text style={styles.rowText}>清除缓存</Text>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.row}>
          <Text style={styles.rowText}>版本</Text>
          <Text style={styles.rowValue}>v{APP_VERSION}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    color: COLORS.primaryText,
    fontSize: 24,
  },
  title: {
    flex: 1,
    color: COLORS.primaryText,
    textAlign: "center",
    marginHorizontal: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  rowText: {
    color: COLORS.primaryText,
    fontSize: 15,
    fontWeight: "600",
  },
  rowValue: {
    color: COLORS.secondaryText,
    fontSize: 14,
  },
  rowArrow: {
    color: COLORS.tertiaryText,
    fontSize: 18,
  },
});

export default SettingsScreen;
