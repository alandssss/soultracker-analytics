import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, RefreshControl, ScrollView, TextInput, TouchableOpacity, Modal } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { SOULLATIINO_LOGO } from "../assets/logo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

const BACKEND_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

// Definición de hitos de bonificación
const BONUS_MILESTONES = [
  { id: 'M0.5', label: 'M0.5', diamonds: 50000, validDays: 22, liveHours: 80, color: '#06d6a0' },
  { id: 'M1R', label: 'M1R', diamonds: 100000, validDays: 22, liveHours: 80, color: '#f4a261' },
  { id: 'M1', label: 'M1', diamonds: 100000, validDays: 22, liveHours: 80, color: '#e76f51' },
  { id: 'M2', label: 'M2', diamonds: 300000, validDays: 22, liveHours: 80, color: '#a8dadc' },
];

interface Creator {
  _id: string;
  creator_id: string;
  username: string;
  manager?: string;
  diamonds: number;
  live_duration_h: number;
  valid_live_days: number;
  goals?: any;
  milestones_near?: any[];
  new_joiner?: boolean;
  alerts?: any[];
  // Nuevos campos para análisis de crecimiento
  prev_diamonds?: number;
  prev_live_duration_h?: number;
  prev_valid_live_days?: number;
}

// Interfaz para análisis de crecimiento
interface GrowthAnalysis {
  diamondsGrowth: number;
  hoursGrowth: number;
  daysGrowth: number;
  overallTrend: 'growing' | 'declining' | 'stable';
  trendIcon: string;
  trendColor: string;
  advice: string;
}

interface MilestoneProgress {
  milestone: typeof BONUS_MILESTONES[0];
  achieved: boolean;
  diamondsProgress: number;
  daysProgress: number;
  hoursProgress: number;
  overallProgress: number;
  isNear: boolean;
}

// Función para calcular el progreso hacia hitos
function calculateMilestoneProgress(creator: Creator): MilestoneProgress[] {
  return BONUS_MILESTONES.map(milestone => {
    const diamondsProgress = Math.min(creator.diamonds / milestone.diamonds, 1);
    const daysProgress = Math.min(creator.valid_live_days / milestone.validDays, 1);
    const hoursProgress = Math.min(creator.live_duration_h / milestone.liveHours, 1);
    
    const achieved = diamondsProgress >= 1 && daysProgress >= 1 && hoursProgress >= 1;
    const overallProgress = (diamondsProgress + daysProgress + hoursProgress) / 3;
    const isNear = overallProgress >= 0.8 && !achieved; // 80% o más pero no completado
    
    return {
      milestone,
      achieved,
      diamondsProgress,
      daysProgress,
      hoursProgress,
      overallProgress,
      isNear,
    };
  });
}

// Función para analizar crecimiento del creador
function analyzeGrowth(creator: Creator): GrowthAnalysis {
  // Debug: Log datos para verificar
  if (creator.creator_id?.startsWith('GROWTH_')) {
    console.log('Growth Analysis Debug:', {
      creator_id: creator.creator_id,
      diamonds: creator.diamonds,
      prev_diamonds: creator.prev_diamonds,
      live_duration_h: creator.live_duration_h,
      prev_live_duration_h: creator.prev_live_duration_h,
      valid_live_days: creator.valid_live_days,
      prev_valid_live_days: creator.prev_valid_live_days
    });
  }

  // Si no hay datos previos (todos los valores previos son 0 o undefined), considerar como 'stable' (nuevo o primer mes)
  const hasPrevData = (creator.prev_diamonds && creator.prev_diamonds > 0) || 
                     (creator.prev_live_duration_h && creator.prev_live_duration_h > 0) || 
                     (creator.prev_valid_live_days && creator.prev_valid_live_days > 0);
  
  if (!hasPrevData) {
    return {
      diamondsGrowth: 0,
      hoursGrowth: 0,
      daysGrowth: 0,
      overallTrend: 'stable',
      trendIcon: '🆕',
      trendColor: '#888',
      advice: 'Nuevo creador - Aún no hay datos históricos para comparar'
    };
  }

  // Calcular crecimiento porcentual solo si hay datos previos válidos
  const diamondsGrowth = (creator.prev_diamonds && creator.prev_diamonds > 0) ? 
    ((creator.diamonds - creator.prev_diamonds) / creator.prev_diamonds) * 100 : 0;
  
  const hoursGrowth = (creator.prev_live_duration_h && creator.prev_live_duration_h > 0) ? 
    ((creator.live_duration_h - creator.prev_live_duration_h) / creator.prev_live_duration_h) * 100 : 0;
  
  const daysGrowth = (creator.prev_valid_live_days && creator.prev_valid_live_days > 0) ? 
    ((creator.valid_live_days - creator.prev_valid_live_days) / creator.prev_valid_live_days) * 100 : 0;

  // Determinar tendencia general (promedio ponderado: diamantes 50%, horas 30%, días 20%)
  const overallGrowth = (diamondsGrowth * 0.5) + (hoursGrowth * 0.3) + (daysGrowth * 0.2);
  
  let overallTrend: 'growing' | 'declining' | 'stable';
  let trendIcon: string;
  let trendColor: string;
  let advice: string;

  if (overallGrowth > 5) {
    overallTrend = 'growing';
    trendIcon = '📈';
    trendColor = '#06d6a0';
    
    if (overallGrowth > 20) {
      advice = '¡Excelente! Mantén esta estrategia y considera aumentar las metas';
    } else {
      advice = 'Buen progreso. Continúa con las actividades actuales';
    }
  } else if (overallGrowth < -5) {
    overallTrend = 'declining';
    trendIcon = '📉';
    trendColor = '#ff6b6b';
    
    if (overallGrowth < -20) {
      advice = 'Necesita atención urgente. Revisar estrategia y motivación';
    } else {
      advice = 'Tendencia a la baja. Analizar causas y ajustar enfoque';
    }
  } else {
    overallTrend = 'stable';
    trendIcon = '➡️';
    trendColor = '#f4a261';
    advice = 'Rendimiento estable. Considerar nuevas estrategias para impulsar crecimiento';
  }

  return {
    diamondsGrowth,
    hoursGrowth,
    daysGrowth,
    overallTrend,
    trendIcon,
    trendColor,
    advice
  };
}

// Función para obtener el próximo hito disponible
function getNextMilestone(creator: Creator): MilestoneProgress | null {
  const progress = calculateMilestoneProgress(creator);
  // Buscar el primer hito no alcanzado
  return progress.find(p => !p.achieved) || null;
}

// Componente para mostrar análisis de crecimiento
function GrowthIndicator({ analysis }: { analysis: GrowthAnalysis }) {
  return (
    <View style={[styles.growthContainer, { borderColor: analysis.trendColor }]}>
      <View style={styles.growthHeader}>
        <Text style={styles.growthIcon}>{analysis.trendIcon}</Text>
        <Text style={styles.growthTitle}>Tendencia Mensual</Text>
      </View>
      
      <View style={styles.growthMetrics}>
        <View style={styles.growthMetric}>
          <Text style={styles.growthLabel}>💎</Text>
          <Text style={[styles.growthValue, { color: analysis.diamondsGrowth > 0 ? '#06d6a0' : analysis.diamondsGrowth < 0 ? '#ff6b6b' : '#888' }]}>
            {analysis.diamondsGrowth > 0 ? '+' : ''}{analysis.diamondsGrowth.toFixed(1)}%
          </Text>
        </View>
        <View style={styles.growthMetric}>
          <Text style={styles.growthLabel}>⏰</Text>
          <Text style={[styles.growthValue, { color: analysis.hoursGrowth > 0 ? '#06d6a0' : analysis.hoursGrowth < 0 ? '#ff6b6b' : '#888' }]}>
            {analysis.hoursGrowth > 0 ? '+' : ''}{analysis.hoursGrowth.toFixed(1)}%
          </Text>
        </View>
        <View style={styles.growthMetric}>
          <Text style={styles.growthLabel}>📅</Text>
          <Text style={[styles.growthValue, { color: analysis.daysGrowth > 0 ? '#06d6a0' : analysis.daysGrowth < 0 ? '#ff6b6b' : '#888' }]}>
            {analysis.daysGrowth > 0 ? '+' : ''}{analysis.daysGrowth.toFixed(1)}%
          </Text>
        </View>
      </View>
      
      <View style={styles.adviceContainer}>
        <Text style={styles.adviceLabel}>💡 Consejo:</Text>
        <Text style={styles.adviceText}>{analysis.advice}</Text>
      </View>
    </View>
  );
}

export default function Dashboard() {
  const [manager, setManager] = useState<string>("");
  const [availableManagers, setAvailableManagers] = useState<string[]>([]);
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [kpis, setKpis] = useState<any>(null);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [alertsOnly, setAlertsOnly] = useState(false);

  const loadManager = useCallback(async () => {
    const m = (await AsyncStorage.getItem("managerName")) || "";
    setManager(m);
  }, []);

  // Función para obtener managers disponibles
  const fetchAvailableManagers = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_BASE}/api/creators`);
      const data = await response.json();
      
      if (data.items) {
        // Extraer managers únicos y filtrar valores vacíos/nulos
        const managers = [...new Set(
          data.items
            .map((creator: Creator) => creator.manager)
            .filter((manager: string) => manager && manager.trim() !== "")
        )].sort();
        
        console.log('Available managers found:', managers);
        setAvailableManagers(managers);
      }
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  }, []);

  const saveManager = useCallback(async () => {
    await AsyncStorage.setItem("managerName", manager || "");
    // fetchData() will be called automatically by useEffect when manager changes
  }, [manager]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Only filter by manager if it's specifically set and not empty
      const shouldFilterByManager = manager && manager.trim() !== "";
      const qManager = shouldFilterByManager ? `?manager=${encodeURIComponent(manager)}` : "";
      const alertsParam = alertsOnly ? (qManager ? "&alerts_only=true" : "?alerts_only=true") : "";
      
      console.log('Fetching data with params:', { 
        manager, 
        shouldFilterByManager, 
        qManager, 
        alertsParam,
        finalUrls: {
          kpis: `${BACKEND_BASE}/api/kpis${qManager}`,
          creators: `${BACKEND_BASE}/api/creators${qManager}${alertsParam}`
        }
      });
      
      const [kpiRes, creatorsRes] = await Promise.all([
        fetch(`${BACKEND_BASE}/api/kpis${qManager}`).then(r => r.json()),
        fetch(`${BACKEND_BASE}/api/creators${qManager}${alertsParam}`).then(r => r.json()),
      ]);
      
      console.log('Fetched KPIs:', kpiRes);
      console.log('Fetched creators count:', creatorsRes.items?.length);
      
      setKpis(kpiRes);
      setCreators(creatorsRes.items || []);
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManager();
    fetchAvailableManagers();
  }, []);

  useEffect(() => {
    fetchData(); // Always fetch data regardless of manager
  }, [manager, alertsOnly]);

  // Auto-refresh when screen comes into focus (e.g., after file upload)
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [manager, alertsOnly])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [alertsOnly, manager]);

  const filtered = creators.filter(c => c.username?.toLowerCase().includes(query.toLowerCase()));

  return (
    <ScrollView style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Image source={{ uri: SOULLATIINO_LOGO }} style={styles.logo} contentFit="contain" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>SoulTracker Analytics</Text>
          <Text style={styles.subtitle}>Filtrar por Manager</Text>
          <TouchableOpacity 
            onPress={() => setShowManagerPicker(true)} 
            style={styles.managerSelector}
          >
            <Text style={styles.managerSelectorText}>
              {manager ? `👤 ${manager}` : "📊 Todos los creadores"}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#6C5CE7" />
          </TouchableOpacity>
          <Text style={styles.managerHint}>
            {availableManagers.length > 0 
              ? `${availableManagers.length} managers disponibles` 
              : "Cargando managers..."}
          </Text>
        </View>
      </View>

      <View style={styles.kpiRow}>
        <KPI label="Creadores Activos" value={kpis?.active_creators ?? "-"} />
        <KPI label="Alertas Activas" value={kpis?.alerts_count ?? "-"} />
        <KPI label="Superestrellas" value={kpis?.superstars ?? "-"} />
      </View>

      <View style={{ height: 16 }} />
      <TextInput
        placeholder="Buscar creador..."
        placeholderTextColor="#888"
        style={styles.search}
        value={query}
        onChangeText={setQuery}
      />

      <TouchableOpacity onPress={() => setAlertsOnly(v => !v)} style={styles.filterBtn}>
        <Text style={styles.filterText}>{alertsOnly ? "Mostrar Todos" : "Solo Alertas"}</Text>
      </TouchableOpacity>

      <View style={{ height: 8 }} />
      <FlashList
        data={filtered}
        keyExtractor={(item) => item._id}
        estimatedItemSize={84}
        renderItem={({ item }) => <CreatorRow item={item} />}
      />
      
      {/* Modal para seleccionar manager */}
      <ManagerPicker
        visible={showManagerPicker}
        onClose={() => setShowManagerPicker(false)}
        managers={availableManagers}
        selectedManager={manager}
        onSelectManager={(selectedManager) => {
          setManager(selectedManager);
          saveManager();
        }}
      />
    </ScrollView>
  );
}

// Componente para seleccionar manager
function ManagerPicker({ 
  visible, 
  onClose, 
  managers, 
  selectedManager, 
  onSelectManager 
}: {
  visible: boolean;
  onClose: () => void;
  managers: string[];
  selectedManager: string;
  onSelectManager: (manager: string) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Seleccionar Manager</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.managersList}>
            {/* Opción para "Todos" */}
            <TouchableOpacity
              style={[
                styles.managerOption,
                selectedManager === "" && styles.managerOptionSelected
              ]}
              onPress={() => {
                onSelectManager("");
                onClose();
              }}
            >
              <Text style={[
                styles.managerOptionText,
                selectedManager === "" && styles.managerOptionTextSelected
              ]}>
                📊 Todos los creadores
              </Text>
              {selectedManager === "" && (
                <Ionicons name="checkmark" size={20} color="#06d6a0" />
              )}
            </TouchableOpacity>
            
            {/* Opciones de managers */}
            {managers.map((managerName) => (
              <TouchableOpacity
                key={managerName}
                style={[
                  styles.managerOption,
                  selectedManager === managerName && styles.managerOptionSelected
                ]}
                onPress={() => {
                  onSelectManager(managerName);
                  onClose();
                }}
              >
                <Text style={[
                  styles.managerOptionText,
                  selectedManager === managerName && styles.managerOptionTextSelected
                ]}>
                  👤 {managerName}
                </Text>
                {selectedManager === managerName && (
                  <Ionicons name="checkmark" size={20} color="#06d6a0" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function KPI({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.kpiBox}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

// Componente de barra de progreso
function ProgressBar({ progress, color, height = 4 }: { progress: number; color: string; height?: number }) {
  return (
    <View style={[styles.progressBarContainer, { height }]}>
      <View 
        style={[
          styles.progressBarFill, 
          { 
            width: `${Math.min(progress * 100, 100)}%`, 
            backgroundColor: color,
            height 
          }
        ]} 
      />
    </View>
  );
}

// Componente para mostrar progreso de hito
function MilestoneCard({ progress }: { progress: MilestoneProgress }) {
  const { milestone, achieved, diamondsProgress, daysProgress, hoursProgress, overallProgress, isNear } = progress;
  
  return (
    <View style={[
      styles.milestoneCard,
      achieved && styles.milestoneAchieved,
      isNear && styles.milestoneNear
    ]}>
      <View style={styles.milestoneHeader}>
        <Text style={[styles.milestoneLabel, achieved && styles.milestoneAchievedText]}>
          {milestone.label}
        </Text>
        <Text style={[styles.milestoneProgress, achieved && styles.milestoneAchievedText]}>
          {(overallProgress * 100).toFixed(0)}%
        </Text>
      </View>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>💎</Text>
          <ProgressBar progress={diamondsProgress} color={milestone.color} />
          <Text style={styles.progressText}>{(diamondsProgress * 100).toFixed(0)}%</Text>
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>📅</Text>
          <ProgressBar progress={daysProgress} color={milestone.color} />
          <Text style={styles.progressText}>{(daysProgress * 100).toFixed(0)}%</Text>
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>⏰</Text>
          <ProgressBar progress={hoursProgress} color={milestone.color} />
          <Text style={styles.progressText}>{(hoursProgress * 100).toFixed(0)}%</Text>
        </View>
      </View>
      
      {achieved && (
        <View style={styles.achievedBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#06d6a0" />
          <Text style={styles.achievedText}>¡Completado!</Text>
        </View>
      )}
      
      {isNear && !achieved && (
        <View style={styles.nearBadge}>
          <Ionicons name="alert-circle" size={16} color="#f4a261" />
          <Text style={styles.nearText}>Cerca de {milestone.label}</Text>
        </View>
      )}
    </View>
  );
}

function CreatorRow({ item }: { item: Creator }) {
  const [expanded, setExpanded] = useState(false);
  const status = item.goals?.status?.code as string | undefined;
  const milestoneProgress = calculateMilestoneProgress(item);
  const nextMilestone = getNextMilestone(item);
  const achievedMilestones = milestoneProgress.filter(p => p.achieved);
  const nearMilestones = milestoneProgress.filter(p => p.isNear);
  const growthAnalysis = analyzeGrowth(item);
  
  // Determinar color de fondo basado en estado de hitos y crecimiento
  let backgroundColor = "#111";
  let borderColor = "transparent";
  
  if (achievedMilestones.length > 0) {
    backgroundColor = "#0d2818"; // Verde oscuro para hitos completados
    borderColor = "#06d6a0";
  } else if (nearMilestones.length > 0) {
    backgroundColor = "#2d1810"; // Naranja oscuro para hitos cercanos
    borderColor = "#f4a261";
  } else if (growthAnalysis.overallTrend === 'growing') {
    backgroundColor = "#1a2d18"; // Verde muy oscuro para crecimiento
    borderColor = "#06d6a080";
  } else if (growthAnalysis.overallTrend === 'declining') {
    backgroundColor = "#2d1818"; // Rojo oscuro para decrecimiento
    borderColor = "#ff6b6b80";
  }
  
  // Icono basado en status original y hitos
  let iconName: any = "hourglass-outline";
  let iconColor = "#bbb";
  
  if (achievedMilestones.length > 0) {
    iconName = "trophy-outline"; 
    iconColor = "#ffd166";
  } else if (status === "SUPERSTAR") { 
    iconName = "trophy-outline"; 
    iconColor = "#ffd166"; 
  } else if (status === "ACHIEVED_PARTIAL") { 
    iconName = "checkmark-done-outline"; 
    iconColor = "#06d6a0"; 
  } else if (status === "NEAR" || nearMilestones.length > 0) { 
    iconName = "alert-circle-outline"; 
    iconColor = "#f4a261"; 
  } else if (growthAnalysis.overallTrend === 'growing') {
    iconName = "trending-up-outline";
    iconColor = "#06d6a0";
  } else if (growthAnalysis.overallTrend === 'declining') {
    iconName = "trending-down-outline";
    iconColor = "#ff6b6b";
  }

  return (
    <TouchableOpacity onPress={() => setExpanded(!expanded)}>
      <View style={[styles.row, { backgroundColor, borderColor, borderWidth: borderColor !== "transparent" ? 1 : 0 }]}>
        <View style={{ flex: 1 }}>
          <View style={styles.rowHeader}>
            <Text style={styles.name}>{item.username}</Text>
            <View style={styles.growthIndicatorCompact}>
              <Text style={styles.growthIconCompact}>{growthAnalysis.trendIcon}</Text>
              <View style={styles.expandIcon}>
                <Ionicons 
                  name={expanded ? "chevron-up" : "chevron-down"} 
                  size={16} 
                  color="#888" 
                />
              </View>
            </View>
          </View>
          
          <Text style={styles.meta}>
            Días: {item.valid_live_days} | Horas: {item.live_duration_h.toFixed(1)} | Diamantes: {item.diamonds.toLocaleString()}
          </Text>
          
          {/* Badges de estado */}
          <View style={styles.badgeContainer}>
            {item.new_joiner && <Text style={styles.badge}>Nuevo (&lt;90d)</Text>}
            {achievedMilestones.length > 0 && (
              <Text style={[styles.badge, styles.achievedBadgeText]}>
                ✅ {achievedMilestones.map(m => m.milestone.label).join(", ")}
              </Text>
            )}
            {nearMilestones.length > 0 && (
              <Text style={[styles.badge, styles.nearBadgeText]}>
                🎯 Cerca de {nearMilestones.map(m => m.milestone.label).join(", ")}
              </Text>
            )}
            {/* Badge de tendencia */}
            <Text style={[styles.badge, { color: growthAnalysis.trendColor }]}>
              {growthAnalysis.trendIcon} {growthAnalysis.overallTrend === 'growing' ? 'Creciendo' : 
                                         growthAnalysis.overallTrend === 'declining' ? 'Decreciendo' : 'Estable'}
            </Text>
            {item.milestones_near?.length && (
              <Text style={styles.badge}>
                Cerca: {item.milestones_near.map(m => `${m.milestone/1000}k`).join(", ")}
              </Text>
            )}
          </View>
          
          {/* Próximo hito - vista compacta */}
          {nextMilestone && !expanded && (
            <View style={styles.nextMilestoneCompact}>
              <Text style={styles.nextMilestoneLabel}>
                Próximo: {nextMilestone.milestone.label} ({(nextMilestone.overallProgress * 100).toFixed(0)}%)
              </Text>
              <ProgressBar progress={nextMilestone.overallProgress} color={nextMilestone.milestone.color} height={3} />
            </View>
          )}
        </View>
        
        <Ionicons name={iconName} size={22} color={iconColor} />
      </View>
      
      {/* Vista expandida con detalles de hitos y análisis de crecimiento */}
      {expanded && (
        <View style={styles.expandedSection}>
          <Text style={styles.expandedTitle}>Análisis de Rendimiento</Text>
          
          {/* Análisis de crecimiento */}
          <GrowthIndicator analysis={growthAnalysis} />
          
          <Text style={styles.expandedTitle}>Progreso de Hitos</Text>
          <View style={styles.milestonesContainer}>
            {milestoneProgress.map((progress, index) => (
              <MilestoneCard key={progress.milestone.id} progress={progress} />
            ))}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0c0c0c", padding: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 56, height: 56, borderRadius: 28 },
  title: { color: "#fff", fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#bbb", fontSize: 12, marginTop: 2 },
  managerRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  managerInput: { flex: 1, backgroundColor: "#1b1b1b", color: "#fff", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  managerSelector: { 
    backgroundColor: "#1b1b1b", 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    paddingVertical: 12, 
    paddingHorizontal: 12, 
    borderRadius: 10, 
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#333"
  },
  managerSelectorText: { 
    color: "#fff", 
    fontSize: 14,
    flex: 1 
  },
  managerHint: { color: "#666", fontSize: 11, marginTop: 4, lineHeight: 14 },
  saveBtn: { backgroundColor: "#6C5CE7", paddingHorizontal: 12, borderRadius: 10, justifyContent: "center" },
  saveText: { color: "#fff", fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1b1b1b",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  modalCloseButton: {
    padding: 4,
  },
  managersList: {
    maxHeight: 400,
  },
  managerOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
  },
  managerOptionSelected: {
    backgroundColor: "#2a2a2a",
  },
  managerOptionText: {
    color: "#fff",
    fontSize: 16,
    flex: 1,
  },
  managerOptionTextSelected: {
    color: "#06d6a0",
    fontWeight: "600",
  },
  kpiRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  kpiBox: { flex: 1, backgroundColor: "#1b1b1b", padding: 12, borderRadius: 12, alignItems: "center" },
  kpiValue: { color: "#fff", fontSize: 18, fontWeight: "700" },
  kpiLabel: { color: "#aaa", marginTop: 2 },
  search: { backgroundColor: "#1b1b1b", color: "#fff", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginTop: 12 },
  filterBtn: { alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "#6C5CE7", marginTop: 8 },
  filterText: { color: "#6C5CE7" },
  row: { 
    backgroundColor: "#111", 
    padding: 12, 
    borderRadius: 12, 
    marginBottom: 8,
    borderWidth: 0,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expandIcon: {
    padding: 4,
  },
  growthIndicatorCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  growthIconCompact: {
    fontSize: 16,
  },
  growthContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
  },
  growthHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  growthIcon: {
    fontSize: 20,
  },
  growthTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  growthMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  growthMetric: {
    alignItems: "center",
    flex: 1,
  },
  growthLabel: {
    fontSize: 16,
    marginBottom: 4,
  },
  growthValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  adviceContainer: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 12,
  },
  adviceLabel: {
    color: "#f4a261",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  adviceText: {
    color: "#ccc",
    fontSize: 12,
    lineHeight: 16,
  },
  name: { color: "#fff", fontSize: 16, fontWeight: "600", flex: 1 },
  meta: { color: "#999", marginTop: 4 },
  badge: { color: "#6C5CE7", marginTop: 4, fontSize: 12 },
  badgeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  achievedBadgeText: {
    color: "#06d6a0",
    fontWeight: "600",
  },
  nearBadgeText: {
    color: "#f4a261",
    fontWeight: "600",
  },
  nextMilestoneCompact: {
    marginTop: 8,
  },
  nextMilestoneLabel: {
    color: "#ccc",
    fontSize: 12,
    marginBottom: 4,
  },
  expandedSection: {
    backgroundColor: "#0a0a0a",
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  expandedTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  milestonesContainer: {
    gap: 8,
  },
  milestoneCard: {
    backgroundColor: "#1a1a1a",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
  },
  milestoneAchieved: {
    backgroundColor: "#0d2818",
    borderColor: "#06d6a0",
  },
  milestoneNear: {
    backgroundColor: "#2d1810",
    borderColor: "#f4a261",
  },
  milestoneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  milestoneLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  milestoneProgress: {
    color: "#ccc",
    fontSize: 14,
  },
  milestoneAchievedText: {
    color: "#06d6a0",
  },
  progressContainer: {
    gap: 4,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressLabel: {
    fontSize: 12,
    width: 20,
  },
  progressText: {
    color: "#999",
    fontSize: 11,
    width: 35,
    textAlign: "right",
  },
  progressBarContainer: {
    flex: 1,
    backgroundColor: "#333",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    borderRadius: 2,
  },
  achievedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  achievedText: {
    color: "#06d6a0",
    fontSize: 12,
    fontWeight: "600",
  },
  nearBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  nearText: {
    color: "#f4a261",
    fontSize: 12,
    fontWeight: "600",
  },
  // Estilos para GrowthIndicator
  growthContainer: {
    backgroundColor: "#1a1a1a",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  growthHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  growthIcon: {
    fontSize: 16,
  },
  growthTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  growthMetrics: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  growthMetric: {
    alignItems: "center",
    gap: 4,
  },
  growthLabel: {
    fontSize: 14,
  },
  growthValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  adviceContainer: {
    backgroundColor: "#2a2a2a",
    padding: 8,
    borderRadius: 6,
  },
  adviceLabel: {
    color: "#f4a261",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  adviceText: {
    color: "#ccc",
    fontSize: 11,
    lineHeight: 16,
  },
});