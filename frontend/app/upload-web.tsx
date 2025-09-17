import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import * as WebBrowser from "expo-web-browser";

const BACKEND_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function UploadWeb() {
  const [loading, setLoading] = useState(false);

  const openUploader = async () => {
    // For now, open the backend Swagger UI for easy web upload using multipart form
    setLoading(true);
    try {
      await WebBrowser.openBrowserAsync(`${BACKEND_BASE}/docs`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Carga Web del Reporte</Text>
      <Text style={styles.subtitle}>Abre el navegador y usa el endpoint /api/upload-report</Text>
      <TouchableOpacity onPress={openUploader} style={styles.primaryBtn}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Abrir en Navegador</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0c0c0c", padding: 24, justifyContent: "center" },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", textAlign: "center" },
  subtitle: { color: "#bbb", fontSize: 14, marginTop: 8, textAlign: "center" },
  primaryBtn: { marginTop: 20, backgroundColor: "#6C5CE7", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});