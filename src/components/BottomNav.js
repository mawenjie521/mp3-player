import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { COLORS, NAV_TABS } from "../data/constants";

function BottomNav({ activeTab, onChange }) {
  return (
    <View style={styles.container}>
      {NAV_TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.6}
          >
            <Text style={[styles.icon, isActive && styles.iconActive]}>
              {tab.icon}
            </Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: COLORS.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ffffff20",
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  icon: {
    fontSize: 22,
    color: COLORS.secondaryText,
  },
  iconActive: {
    color: COLORS.accent,
  },
  label: {
    fontSize: 11,
    color: COLORS.secondaryText,
    marginTop: 2,
  },
  labelActive: {
    color: COLORS.accent,
    fontWeight: "600",
  },
});

export default BottomNav;
