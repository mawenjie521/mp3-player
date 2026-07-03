import AsyncStorage from "@react-native-async-storage/async-storage";

export async function loadJSON(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 静默失败——存储不可用不应阻断 UI
  }
}

export async function removeKey(key) {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // 同上
  }
}
