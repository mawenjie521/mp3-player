import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView } from "react-native";
import { COLORS } from "../data/constants";

function OcrChapterEditScreen({ chapterTitle, initialText, onSave, onBack, onSplitHere }) {
  const [text, setText] = useState(initialText);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{chapterTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TextInput
          style={styles.editor}
          value={text}
          onChangeText={setText}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          multiline
          textAlignVertical="top"
          autoFocus
          placeholder="（识别为空，请手动输入）"
          placeholderTextColor={COLORS.secondaryText}
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity
            onPress={() => onSave(text)}
            style={styles.saveBtn}
          >
            <Text style={styles.saveBtnText}>保存</Text>
          </TouchableOpacity>
          {onSplitHere && (
            <TouchableOpacity
              onPress={() => onSplitHere(text, selection.start)}
              style={[styles.saveBtn, styles.splitBtn]}
            >
              <Text style={styles.saveBtnText}>在光标处拆分</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
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
    color: COLORS.accentNovel,
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
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  editor: {
    flex: 1,
    color: COLORS.primaryText,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: "top",
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: "row",
  },
  saveBtn: {
    flex: 1,
    backgroundColor: COLORS.accentNovel,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: "center",
  },
  splitBtn: {
    marginLeft: 12,
    backgroundColor: COLORS.secondaryText,
  },
  saveBtnText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default OcrChapterEditScreen;
