import React, { Component } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../data/constants";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.warn("ErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>出错了</Text>
          <Text style={styles.message}>
            {this.state.error && this.state.error.message
              ? this.state.error.message
              : "应用发生未知错误"}
          </Text>
          <TouchableOpacity onPress={this.handleReset} style={styles.button}>
            <Text style={styles.buttonText}>重试</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: COLORS.primaryText,
    fontSize: 20,
    fontWeight: "600",
  },
  message: {
    color: COLORS.secondaryText,
    fontSize: 14,
    marginTop: 8,
    marginHorizontal: 32,
    textAlign: "center",
  },
  button: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  buttonText: {
    color: COLORS.accent,
    fontSize: 15,
  },
});

export default ErrorBoundary;
