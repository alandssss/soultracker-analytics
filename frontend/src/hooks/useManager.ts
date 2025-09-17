import { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "managerName";

export function useManager() {
  const [manager, setManager] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const val = await AsyncStorage.getItem(KEY);
        setManager(val || "Manager");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = useCallback(async (name: string) => {
    setManager(name);
    await AsyncStorage.setItem(KEY, name);
  }, []);

  return { manager, setManager: save, loading };
}