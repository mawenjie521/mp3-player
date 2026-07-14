import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert } from "react-native";
import { COLORS, APP_VERSION } from "../data/constants";
import NowPlayingBar from "../components/NowPlayingBar";

function SettingsScreen({ currentTrack, onShowPlayer, onBack, onClearCache }) {
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

  const handleFeedback = () => {
    Alert.alert("反馈/评分", "感谢支持，评分功能即将上线");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>设置</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={{ flex: 1 }}>
        <TouchableOpacity style={styles.row} onPress={() => {}}>
          <Text style={styles.rowText}>关于</Text>
          <Text style={styles.rowValue}>v{APP_VERSION}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={handleClearCache}>
          <Text style={styles.rowText}>清除缓存</Text>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={handleFeedback}>
          <Text style={styles.rowText}>反馈/评分</Text>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
      </ScrollView>
      <NowPlayingBar currentTrack={currentTrack} onPress={onShowPlayer} />
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    color: COLORS.accent,
    fontSize: 16,
  },
  title: {
    color: COLORS.primaryText,
    fontSize: 17,
    fontWeight: "600",
  },
  headerSpacer: {
    width: 60,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ffffff10",
  },
  rowText: {
    color: COLORS.primaryText,
    fontSize: 16,
  },
  rowValue: {
    color: COLORS.secondaryText,
    fontSize: 14,
  },
  rowArrow: {
    color: COLORS.secondaryText,
    fontSize: 18,
  },
});

export default SettingsScreen;
