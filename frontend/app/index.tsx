import React, { useEffect, useState } from "react";
import { Text, View, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { SOULLATIINO_LOGO } from "../assets/logo";

const BACKEND_BASE = process.env.EXPO_PUBLIC_BACKEND_URL; // K8 ingress routes /api -> 8001

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      try {
        const storedManager = (await AsyncStorage.getItem("managerName")) || (Platform.OS === "ios" ? "iOS Manager" : "Android Manager");
        if (!Constants.isDevice) {
          setLoading(false);
          return;
        }
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") {
          setError("Permiso de notificaciones no concedido");
          setLoading(false);
          return;
        }
        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData.data;
        await fetch(`${BACKEND_BASE}/api/push/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manager: storedManager, token }),
        });
      } catch (e: any) {
        setError(e?.message || "Error de inicialización");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}> 
        <ActivityIndicator color="#fff" />
        <Text style={styles.msg}>Inicializando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={{ uri: SOULLATIINO_LOGO }} style={styles.logo} contentFit="contain" />
      <Text style={styles.title}>SoulTracker Analytics</Text>
      <Text style={styles.subtitle}>Panel del Administrador</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ height: 24 }} />
      <TouchableOpacity onPress={() => router.push("/dashboard")} style={styles.primaryBtn}>
        <Text style={styles.primaryText}>Ir al Dashboard</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/upload")} style={styles.secondaryBtn}>
        <Text style={styles.secondaryText}>Cargar Reporte</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#0c0c0c", alignItems: "center", justifyContent: "center" },
  msg: { color: "#fff", marginTop: 8 },
  container: { flex: 1, backgroundColor: "#0c0c0c", padding: 24, justifyContent: "center", alignItems: "center" },
  logo: { width: 160, height: 160, marginBottom: 12, borderRadius: 80 },
  title: { color: "#fff", fontSize: 28, fontWeight: "700", textAlign: "center" },
  subtitle: { color: "#bbb", fontSize: 16, marginTop: 6, textAlign: "center" },
  error: { color: "#ff6b6b", textAlign: "center", marginTop: 12 },
  primaryBtn: { width: "100%", backgroundColor: "#6C5CE7", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryBtn: { width: "100%", marginTop: 12, borderColor: "#6C5CE7", borderWidth: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  secondaryText: { color: "#6C5CE7", fontSize: 16, fontWeight: "600" },
});