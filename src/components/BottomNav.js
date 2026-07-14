import React from "react";
import { View, TouchableOpacity, Text, StyleSheet, SafeAreaView } from "react-native";
import { COLORS, NAV_TABS } from "../data/constants";

function BottomNav({ activeTab, onChange, accentColor = COLORS.accent }) {
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.row}>
        {NAV_TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const tabAccent = tab.key === "novels" ? COLORS.accentNovel : accentColor;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => onChange(tab.key)}
              activeOpacity={0.6}
            >
              <Text style={[styles.icon, { color: isActive ? tabAccent : COLORS.tertiaryText }]}>
                {tab.icon}
              </Text>
              <Text style={[styles.label, { color: isActive ? tabAccent : COLORS.tertiaryText, fontWeight: isActive ? "600" : "400" }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.separator,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontSize: 11,
    marginTop: 2,
  },
});

export default BottomNav;
