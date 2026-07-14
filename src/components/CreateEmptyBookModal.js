import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { COLORS, TYPO } from "../data/constants";

function CreateEmptyBookModal({ visible, onCreate, onCancel }) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (visible) setTitle("");
  }, [visible]);

  const trimmed = title.trim();

  const handleCreate = () => {
    if (!trimmed) return;
    onCreate(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={[styles.title, TYPO.titleMedium]}>创建空小说</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="输入书名"
            placeholderTextColor={COLORS.secondaryText}
            autoFocus
          />
          <View style={styles.btnRow}>
            <TouchableOpacity onPress={onCancel} style={styles.outlineBtn}>
              <Text style={styles.outlineBtnText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreate}
              disabled={!trimmed}
              style={[styles.primaryBtn, !trimmed && styles.primaryBtnDisabled]}
            >
              <Text style={styles.primaryBtnText}>创建</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "80%",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
  },
  title: {
    color: COLORS.primaryText,
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    color: COLORS.primaryText,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.separator,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: "row",
    gap: 12,
  },
  outlineBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.accentNovel,
    flex: 1,
    alignItems: "center",
  },
  outlineBtnText: {
    color: COLORS.accentNovel,
    fontSize: 15,
    fontWeight: "600",
  },
  primaryBtn: {
    backgroundColor: COLORS.accentNovel,
    paddingVertical: 10,
    borderRadius: 20,
    flex: 1,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.4,
  },
  primaryBtnText: {
    color: COLORS.surface,
    fontSize: 15,
    fontWeight: "600",
  },
});

export default CreateEmptyBookModal;
