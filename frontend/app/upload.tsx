import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import mime from "mime";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { SOULLATIINO_LOGO } from "../assets/logo";
import { useRouter } from "expo-router";

const BACKEND_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

interface UploadResult {
  success: boolean;
  message: string;
  processed?: number;
  period?: string;
}

export default function Upload() {
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const router = useRouter();

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'application/vnd.ms-excel', // .xls (legacy)
        ],
        copyToCacheDirectory: true, // Fixes Android read issues
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        let file = result.assets[0];
        
        // Validate file size (max 10MB)
        if (file.size && file.size > 10 * 1024 * 1024) {
          Alert.alert("Error", "El archivo es demasiado grande. Máximo 10MB.");
          return;
        }

        // Validate file extension
        const validExtensions = ['.xlsx', '.xls'];
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        
        if (!validExtensions.includes(fileExtension)) {
          Alert.alert("Error", "Tipo de archivo no válido. Solo se permiten archivos .xlsx o .xls");
          return;
        }

        // Android URI fix - ensure file:// URI for readability
        if (Platform.OS === 'android' && !file.uri.startsWith('file://')) {
          try {
            const cacheUri = FileSystem.cacheDirectory + file.name;
            await FileSystem.copyAsync({ from: file.uri, to: cacheUri });
            file.uri = cacheUri;
            console.log('Android URI fixed:', file.uri);
          } catch (copyError) {
            console.warn('Failed to copy file to cache:', copyError);
            // Continue with original URI if copy fails
          }
        }

        // Set precise MIME type
        file.type = mime.getType(file.name) || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        setSelectedFile(file);
        setUploadResult(null);
        
        console.log('File ready:', { 
          name: file.name, 
          uri: file.uri, 
          type: file.type, 
          size: file.size 
        });
        
        // Clear any previous upload results
        setUploadResult(null);
      }
    } catch (error) {
      console.error("Error picking document:", error);
      Alert.alert("Error", "No se pudo seleccionar el archivo");
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setUploadResult(null);
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadResult(null);

    try {
      let blob: Blob;

      if (Platform.OS === 'web') {
        // Web platform: Use fetch to get the blob directly
        const response = await fetch(selectedFile.uri);
        blob = await response.blob();
      } else {
        // Mobile platforms: Use expo-file-system to read as base64, then convert to blob
        const fileData = await FileSystem.readAsStringAsync(selectedFile.uri, {
          encoding: 'base64',
        });

        // Convert base64 to blob
        const response = await fetch(`data:${selectedFile.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};base64,${fileData}`);
        blob = await response.blob();
      }

      const formData = new FormData();
      formData.append('file', blob, selectedFile.name);

      console.log('Uploading file:', {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type || selectedFile.mimeType,
        blobSize: blob.size,
        platform: Platform.OS
      });

      const uploadResponse = await fetch(`${BACKEND_BASE}/api/upload-report`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          // Don't set Content-Type header - let browser set it with boundary
        },
      });

      console.log('Upload response status:', uploadResponse.status);
      const result = await uploadResponse.json();
      console.log('Upload result:', result);

      if (uploadResponse.ok) {
        if (result.processed && result.processed > 0) {
          setUploadResult({
            success: true,
            message: `Reporte cargado exitosamente. ${result.processed} creadores procesados.`,
            processed: result.processed,
            period: result.period
          });
          
          // Show success alert and auto-navigate to dashboard
          Alert.alert(
            "¡Éxito!", 
            `Reporte cargado correctamente.\n\nCreadores procesados: ${result.processed}\nPeríodo: ${result.period}\n\nVe al Dashboard para ver los datos actualizados.`,
            [
              { text: "Ver Dashboard", onPress: () => router.push("/dashboard") },
              { text: "Cargar Otro", style: "cancel" }
            ]
          );
        } else {
          // Upload succeeded but no data processed
          setUploadResult({
            success: false,
            message: "No se procesaron datos. Verifica que el archivo tenga las columnas correctas y datos válidos."
          });
          
          Alert.alert(
            "Advertencia", 
            "El archivo se subió pero no se procesaron datos.\n\nVerifica que contenga:\n- Columnas requeridas (Creator ID, Creator's username, etc.)\n- Datos válidos en las filas\n\nRevisa el formato del archivo."
          );
        }
      } else {
        // Get error detail from response
        let errorDetail = "Error al procesar el archivo";
        if (result.detail) {
          errorDetail = typeof result.detail === 'string' ? result.detail : JSON.stringify(result.detail);
        } else if (result.error) {
          errorDetail = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
        }
        
        throw new Error(errorDetail);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      
      let errorMessage = "Error al cargar el archivo";
      
      // Ensure error message is always a string
      if (error?.message) {
        if (typeof error.message === 'string') {
          errorMessage = error.message;
        } else {
          errorMessage = JSON.stringify(error.message);
        }
      } else if (error) {
        errorMessage = typeof error === 'string' ? error : JSON.stringify(error);
      }
      
      // Special handling for network errors
      if (errorMessage.includes("Network request failed")) {
        errorMessage = "Error de conexión. Verifica tu internet y el URI del archivo.";
      }
      
      setUploadResult({
        success: false,
        message: errorMessage
      });
      
      Alert.alert("Error", errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes) return "Tamaño desconocido";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return Math.round(bytes / 1024) + " KB";
    return Math.round(bytes / 1048576) + " MB";
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Image source={{ uri: SOULLATIINO_LOGO }} style={styles.logo} contentFit="contain" />
        <View style={styles.headerText}>
          <Text style={styles.title}>Cargar Reporte</Text>
          <Text style={styles.subtitle}>Subir archivo XLSX</Text>
        </View>
      </View>

      {/* File Selection Area */}
      <View style={styles.uploadArea}>
        {!selectedFile ? (
          <TouchableOpacity onPress={pickDocument} style={styles.selectButton}>
            <Ionicons name="cloud-upload-outline" size={48} color="#6C5CE7" />
            <Text style={styles.selectButtonText}>Seleccionar Archivo</Text>
            <Text style={styles.selectButtonSubtext}>XLSX, XLS • Máx. 10MB</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.fileInfo}>
            <View style={styles.fileHeader}>
              <Ionicons name="document-outline" size={32} color="#6C5CE7" />
              <TouchableOpacity onPress={removeFile} style={styles.removeButton}>
                <Ionicons name="close-circle" size={24} color="#ff6b6b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.fileName}>{selectedFile.name}</Text>
            <Text style={styles.fileSize}>{formatFileSize(selectedFile.size)}</Text>
            
            {/* Upload Button */}
            <TouchableOpacity 
              onPress={uploadFile} 
              disabled={uploading}
              style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="cloud-upload" size={20} color="#fff" />
              )}
              <Text style={styles.uploadButtonText}>
                {uploading ? "Cargando..." : "Cargar Reporte"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Upload Result */}
      {uploadResult && (
        <View style={[styles.resultContainer, uploadResult.success ? styles.successResult : styles.errorResult]}>
          <Ionicons 
            name={uploadResult.success ? "checkmark-circle" : "alert-circle"} 
            size={24} 
            color={uploadResult.success ? "#06d6a0" : "#ff6b6b"} 
          />
          <Text style={[styles.resultText, { color: uploadResult.success ? "#06d6a0" : "#ff6b6b" }]}>
            {uploadResult.message}
          </Text>
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Instrucciones:</Text>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>1.</Text>
          <Text style={styles.instructionText}>El archivo debe contener las columnas: Creator ID, Creator's username, Diamonds, LIVE duration, Valid go LIVE days, Joined time, manager, Data period</Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>2.</Text>
          <Text style={styles.instructionText}>Formatos aceptados: XLSX, XLS</Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>3.</Text>
          <Text style={styles.instructionText}>Tamaño máximo: 10MB</Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>4.</Text>
          <Text style={styles.instructionText}>Después de cargar, podrás ver los datos actualizados en el Dashboard</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0c0c0c",
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    color: "#bbb",
    fontSize: 14,
    marginTop: 2,
  },
  uploadArea: {
    backgroundColor: "#1b1b1b",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#333",
    borderStyle: "dashed",
  },
  selectButton: {
    alignItems: "center",
    paddingVertical: 32,
  },
  selectButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
  },
  selectButtonSubtext: {
    color: "#888",
    fontSize: 14,
    marginTop: 4,
  },
  fileInfo: {
    alignItems: "center",
  },
  fileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 12,
  },
  removeButton: {
    padding: 4,
  },
  fileName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  fileSize: {
    color: "#888",
    fontSize: 14,
    marginBottom: 20,
  },
  uploadButton: {
    backgroundColor: "#6C5CE7",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  uploadButtonDisabled: {
    backgroundColor: "#444",
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  resultContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  successResult: {
    backgroundColor: "#06d6a0",
    backgroundColor: "rgba(6, 214, 160, 0.1)",
    borderWidth: 1,
    borderColor: "#06d6a0",
  },
  errorResult: {
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    borderWidth: 1,
    borderColor: "#ff6b6b",
  },
  resultText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  instructionsContainer: {
    backgroundColor: "#1b1b1b",
    borderRadius: 12,
    padding: 16,
  },
  instructionsTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: "row",
    marginBottom: 8,
    alignItems: "flex-start",
  },
  instructionNumber: {
    color: "#6C5CE7",
    fontSize: 14,
    fontWeight: "600",
    marginRight: 8,
    marginTop: 1,
  },
  instructionText: {
    color: "#ccc",
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});