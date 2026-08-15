import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import apiClient from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface IrrigationAdvice {
  action: string;
  water_amount_liters_per_m2: number;
  fertilizer_suggestion: string | null;
  reasoning: string;
}

export default function SmartIrrigationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const token = useAuthStore(state => state.token);
  
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  // Farm & Batch selection
  const [farms, setFarms] = useState<any[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);

  // Form Inputs
  const [cropType, setCropType] = useState('Lúa nước');
  const [growthStage, setGrowthStage] = useState('Đẻ nhánh');
  const [soilMoisture, setSoilMoisture] = useState('45');
  const [weatherForecast, setWeatherForecast] = useState('Nắng nóng, không mưa');
  
  // AI Result
  const [advice, setAdvice] = useState<IrrigationAdvice | null>(null);

  useEffect(() => {
    fetchFarms();
  }, []);

  const fetchFarms = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/farms/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFarms(res.data);
      if (res.data.length > 0) {
        setSelectedFarm(res.data[0]);
        fetchBatches(res.data[0].id);
      }
    } catch (error) {
      console.log('Error fetching farms', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async (farmId: number) => {
    try {
      const res = await apiClient.get(`/farming/farms/${farmId}/batches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBatches(res.data);
      if (res.data.length > 0) {
        setSelectedBatch(res.data[0]);
      }
    } catch (error) {
      console.log('Error fetching batches', error);
    }
  };

  const handleAnalyze = async () => {
    if (!cropType || !soilMoisture || !weatherForecast) {
      Alert.alert('Lỗi', 'Vui lòng điền đủ thông tin');
      return;
    }
    setAnalyzing(true);
    try {
      const res = await apiClient.post('/ai/irrigation-advice', {
        crop_type: cropType,
        growth_stage: growthStage,
        soil_moisture: parseFloat(soilMoisture),
        weather_forecast: weatherForecast
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdvice(res.data);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể phân tích dữ liệu lúc này');
      console.log(error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTriggerAction = async () => {
    if (!selectedBatch) {
      Alert.alert('Lỗi', 'Vui lòng chọn lô canh tác');
      return;
    }
    
    let activityType = 'Tưới nước';
    let desc = `Tưới tự động AI: ${advice?.water_amount_liters_per_m2} lít/m2.`;
    
    if (advice?.action === 'fertilize') {
      activityType = 'Bón phân';
      desc = `Bón phân tự động AI: ${advice?.fertilizer_suggestion}. Tưới ${advice?.water_amount_liters_per_m2} lít/m2.`;
    }

    try {
      await apiClient.post(`/farming/batches/${selectedBatch.id}/logs`, {
        activity_type: activityType,
        description: desc
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert('Thành công', 'Đã kích hoạt hệ thống và lưu lịch sử vào Nhật ký nông vụ!');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể kích hoạt tự động');
    }
  };

  const getActionColor = (action: string) => {
    if (action === 'irrigate') return '#3B82F6'; // blue
    if (action === 'fertilize') return '#10B981'; // green
    return '#F59E0B'; // yellow (wait)
  };

  const getActionText = (action: string) => {
    if (action === 'irrigate') return 'Cần Tưới Nước';
    if (action === 'fertilize') return 'Cần Bón Phân';
    return 'Chờ Đợi / Không Cần Tưới';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textLight} />
        </TouchableOpacity>
        <Text style={styles.title}>Tưới tiêu Thông minh</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Batch Selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Lô canh tác áp dụng</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
            {batches.map(b => (
              <TouchableOpacity 
                key={b.id} 
                style={[styles.batchChip, selectedBatch?.id === b.id && styles.batchChipActive]}
                onPress={() => setSelectedBatch(b)}
              >
                <Text style={[styles.batchChipText, selectedBatch?.id === b.id && styles.batchChipTextActive]}>
                  {b.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Context Inputs */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="leaf-outline" size={20} color={colors.textLight} />
            <Text style={styles.cardTitle}>Thông số hiện tại</Text>
          </View>
          
          <Text style={styles.inputLabel}>Loại cây trồng</Text>
          <TextInput style={styles.input} value={cropType} onChangeText={setCropType} />
          
          <Text style={styles.inputLabel}>Giai đoạn sinh trưởng</Text>
          <TextInput style={styles.input} value={growthStage} onChangeText={setGrowthStage} />
          
          <View style={styles.row}>
            <View style={styles.flexHalf}>
              <Text style={styles.inputLabel}>Độ ẩm đất (%)</Text>
              <TextInput style={styles.input} value={soilMoisture} onChangeText={setSoilMoisture} keyboardType="numeric" />
            </View>
            <View style={styles.flexHalf}>
              <Text style={styles.inputLabel}>Dự báo thời tiết</Text>
              <TextInput style={styles.input} value={weatherForecast} onChangeText={setWeatherForecast} />
            </View>
          </View>

          <TouchableOpacity style={styles.analyzeBtn} onPress={handleAnalyze} disabled={analyzing}>
            {analyzing ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="sparkles" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.analyzeBtnText}>Phân Tích Bằng AI</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* AI Result */}
        {advice && (
          <View style={[styles.card, { borderColor: getActionColor(advice.action), borderWidth: 2 }]}>
            <View style={styles.resultHeader}>
              <View style={[styles.actionBadge, { backgroundColor: getActionColor(advice.action) }]}>
                <Text style={styles.actionBadgeText}>{getActionText(advice.action)}</Text>
              </View>
            </View>

            <View style={styles.resultRow}>
              <Ionicons name="water-outline" size={20} color="#3B82F6" />
              <Text style={styles.resultText}>Lượng nước: <Text style={styles.bold}>{advice.water_amount_liters_per_m2} lít/m²</Text></Text>
            </View>

            {advice.fertilizer_suggestion && (
              <View style={styles.resultRow}>
                <Ionicons name="leaf-outline" size={20} color="#10B981" />
                <Text style={styles.resultText}>Phân bón: <Text style={styles.bold}>{advice.fertilizer_suggestion}</Text></Text>
              </View>
            )}

            <View style={[styles.resultRow, { alignItems: 'flex-start' }]}>
              <Ionicons name="information-circle-outline" size={20} color={colors.textMutedLight} style={{ marginTop: 2 }} />
              <Text style={styles.reasoningText}>{advice.reasoning}</Text>
            </View>

            {advice.action !== 'wait' && (
              <TouchableOpacity style={[styles.triggerBtn, { backgroundColor: getActionColor(advice.action) }]} onPress={handleTriggerAction}>
                <Ionicons name={advice.action === 'irrigate' ? 'water' : 'flash'} size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.triggerBtnText}>
                  {advice.action === 'irrigate' ? 'Bật Máy Bơm Tự Động' : 'Kích Hoạt Bón Phân'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8F6' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.textLight },
  scrollContent: { padding: 16 },
  
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.textLight, marginLeft: 8 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textLight, marginBottom: 12 },
  
  batchChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, backgroundColor: '#F3F6F4', marginRight: 10, borderWidth: 1, borderColor: '#E8EFEA' },
  batchChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  batchChipText: { fontFamily: fonts.medium, color: '#6B7280', fontSize: 14 },
  batchChipTextActive: { color: '#fff' },

  inputLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMutedLight, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, fontFamily: fonts.medium, fontSize: 15, color: colors.textLight },
  row: { flexDirection: 'row', gap: 12 },
  flexHalf: { flex: 1 },
  
  analyzeBtn: { flexDirection: 'row', backgroundColor: colors.primary, padding: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  analyzeBtnText: { fontFamily: fonts.bold, fontSize: 16, color: '#fff' },

  resultHeader: { alignItems: 'center', marginBottom: 16 },
  actionBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  actionBadgeText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },
  
  resultRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  resultText: { fontFamily: fonts.regular, fontSize: 15, color: colors.textLight, marginLeft: 12 },
  bold: { fontFamily: fonts.bold },
  reasoningText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMutedLight, marginLeft: 12, flex: 1, lineHeight: 22 },

  triggerBtn: { flexDirection: 'row', padding: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  triggerBtnText: { fontFamily: fonts.bold, fontSize: 16, color: '#fff' },
});
