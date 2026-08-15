import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator, ScrollView, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polygon } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { colors, fonts } from '../theme';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiClient from '../api/client';
import { useAuthStore } from '../store/useAuthStore';

const { width } = Dimensions.get('window');

type IndexType = 'NDVI' | 'MOISTURE';

interface FarmData {
  id: string;
  name: string;
  cropType: string;
  area: number;
  polygon: Array<{ latitude: number; longitude: number }>;
}

// Color helpers
const getNdviColor = (v: number) => {
  if (v >= 0.7) return '#0BDA50';
  if (v >= 0.5) return '#84CC16';
  if (v >= 0.3) return '#F59E0B';
  return '#EF4444';
};
const getNdviLabel = (v: number) => {
  if (v >= 0.7) return 'Thảm thực vật rất tốt';
  if (v >= 0.5) return 'Thảm thực vật tốt';
  if (v >= 0.3) return 'Thảm thực vật trung bình';
  return 'Thảm thực vật kém';
};

export default function SatelliteMonitoringScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const token = useAuthStore(state => state.token);

  const farmId: string | undefined = route.params?.farmId;

  const [loading, setLoading] = useState(true);
  const [farm, setFarm] = useState<FarmData | null>(null);
  const [allFarms, setAllFarms] = useState<FarmData[]>([]);
  const [activeIndex, setActiveIndex] = useState<IndexType>('NDVI');
  const mapRef = useRef<MapView>(null);

  // Mock analytics data — replace with real Copernicus/backend data when ready
  const ndviHistory = [
    { value: 0.42, label: 'T1' },
    { value: 0.50, label: 'T2' },
    { value: 0.63, label: 'T3' },
    { value: 0.71, label: 'T4' },
    { value: 0.68, label: 'T5' },
    { value: 0.75, label: 'T6' },
  ];
  const moistureHistory = [
    { value: 38, label: 'T1' },
    { value: 45, label: 'T2' },
    { value: 58, label: 'T3' },
    { value: 62, label: 'T4' },
    { value: 66, label: 'T5' },
    { value: 70, label: 'T6' },
  ];

  const currentNDVI = ndviHistory[ndviHistory.length - 1].value;
  const currentMoisture = moistureHistory[moistureHistory.length - 1].value;

  useEffect(() => {
    fetchFarms();
  }, []);

  const fetchFarms = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/farms/', { headers: { Authorization: `Bearer ${token}` } });
      const formatted: FarmData[] = res.data.map((f: any) => ({
        id: f.id.toString(),
        name: f.name,
        cropType: f.crop_type || 'Chưa xác định',
        area: f.area_size || 0,
        polygon: (f.coordinates || []).map((c: any) => ({ latitude: c.lat, longitude: c.lng })),
      }));
      setAllFarms(formatted);

      const target = farmId ? formatted.find(f => f.id === farmId) : formatted[0];
      if (target) {
        setFarm(target);
        centerMap(target.polygon);
      }
    } catch (e) {
      console.log('Fetch farms error:', e);
    } finally {
      setLoading(false);
    }
  };

  const centerMap = (polygon: Array<{ latitude: number; longitude: number }>) => {
    if (!polygon || polygon.length === 0) return;
    const lat = polygon.reduce((s, c) => s + c.latitude, 0) / polygon.length;
    const lng = polygon.reduce((s, c) => s + c.longitude, 0) / polygon.length;
    mapRef.current?.animateToRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    });
  };

  const selectFarm = (f: FarmData) => {
    setFarm(f);
    centerMap(f.polygon);
  };

  const indexColor = activeIndex === 'NDVI' ? getNdviColor(currentNDVI) : '#3B82F6';
  const currentValue = activeIndex === 'NDVI' ? currentNDVI : currentMoisture;
  const chartData = activeIndex === 'NDVI' ? ndviHistory : moistureHistory;
  const indexUnit = activeIndex === 'NDVI' ? '' : '%';
  const indexLabel = activeIndex === 'NDVI' ? getNdviLabel(currentNDVI) : 'Độ ẩm đất tốt';

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.textLight} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Giám sát Vệ tinh</Text>
          {farm && <Text style={styles.headerSub}>{farm.name}</Text>}
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchFarms}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Đang tải dữ liệu vệ tinh...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* ── Farm Chips ── */}
          {allFarms.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {allFarms.map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.chip, farm?.id === f.id && styles.chipActive]}
                  onPress={() => selectFarm(f)}
                >
                  <Ionicons name="leaf" size={14} color={farm?.id === f.id ? '#fff' : colors.textMutedLight} />
                  <Text style={[styles.chipText, farm?.id === f.id && styles.chipTextActive]}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* ── Map ── */}
          <View style={styles.mapCard}>
            <MapView
              ref={mapRef}
              style={styles.map}
              mapType="satellite"
              scrollEnabled
              zoomEnabled
              initialRegion={{
                latitude: farm?.polygon[0]?.latitude ?? 10.034,
                longitude: farm?.polygon[0]?.longitude ?? 105.784,
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
              }}
            >
              {farm && farm.polygon.length >= 3 && (
                <Polygon
                  coordinates={farm.polygon}
                  fillColor={indexColor + '55'}
                  strokeColor={indexColor}
                  strokeWidth={2.5}
                />
              )}
            </MapView>
            <View style={styles.mapOverlay}>
              <Text style={styles.mapOverlayName}>{farm?.name ?? 'Chưa chọn vùng trồng'}</Text>
              <Text style={styles.mapOverlaySub}>
                {farm ? `${farm.cropType} • ${farm.area > 0 ? farm.area + ' ha' : ''}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.body}>
            {/* ── Index Toggle ── */}
            <View style={styles.toggleRow}>
              <IndexToggleBtn label="Chỉ số NDVI" icon="leaf-outline" id="NDVI" active={activeIndex} onPress={setActiveIndex} color={getNdviColor(currentNDVI)} />
              <IndexToggleBtn label="Độ ẩm (NDMI)" icon="water-outline" id="MOISTURE" active={activeIndex} onPress={setActiveIndex} color="#3B82F6" />
            </View>

            {/* ── Current Value Card ── */}
            <View style={[styles.valueCard, { borderLeftColor: indexColor }]}>
              <View>
                <Text style={styles.valueCardLabel}>Chỉ số hiện tại</Text>
                <Text style={[styles.valueCardNum, { color: indexColor }]}>
                  {typeof currentValue === 'number' ? currentValue.toFixed(activeIndex === 'NDVI' ? 2 : 0) : currentValue}
                  <Text style={styles.valueCardUnit}>{indexUnit}</Text>
                </Text>
                <Text style={styles.valueCardSub}>Cập nhật 24 giờ qua</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: indexColor + '20' }]}>
                <Ionicons name="checkmark-circle" size={18} color={indexColor} />
                <Text style={[styles.statusBadgeText, { color: indexColor }]}>{indexLabel}</Text>
              </View>
            </View>

            {/* ── 6-Month Chart ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Xu hướng 6 tháng qua</Text>
              <LineChart
                data={chartData}
                width={width - 80}
                height={150}
                color={indexColor}
                thickness={3}
                dataPointsColor={indexColor}
                dataPointsRadius={5}
                hideRules
                hideYAxisText
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor="#F0F0F0"
                xAxisLabelTextStyle={{ fontFamily: fonts.medium, color: colors.textMutedLight, fontSize: 11 }}
                curved
                isAnimated
              />
            </View>

            {/* ── Metrics Grid ── */}
            <Text style={styles.sectionTitle}>Thông số chi tiết</Text>
            <View style={styles.metricsGrid}>
              <MetricCard icon="leaf" color="#0BDA50" label="NDVI" value={currentNDVI.toFixed(2)} sub={getNdviLabel(currentNDVI)} />
              <MetricCard icon="water" color="#3B82F6" label="Độ ẩm đất" value={`${currentMoisture}%`} sub="Đo từ bề mặt 5cm" />
              <MetricCard icon="thermometer" color="#F59E0B" label="Nhiệt bề mặt" value="28°C" sub="LST (°C)" />
              <MetricCard icon="cloud" color="#64748B" label="Độ che mây" value="12%" sub="Cloud Cover" />
            </View>

            {/* ── Farm Details ── */}
            {farm && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Thông tin vùng trồng</Text>
                <DetailRow label="Tên vùng" value={farm.name} />
                <DetailRow label="Loại cây" value={farm.cropType} />
                <DetailRow label="Diện tích" value={farm.area > 0 ? `${farm.area} ha` : 'Chưa xác định'} />
                <DetailRow label="Số điểm GPS" value={`${farm.polygon.length} điểm`} last />
              </View>
            )}

            {/* ── NDVI Scale ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Thang đánh giá NDVI</Text>
              {[
                { range: '0.7 – 1.0', label: 'Rất tốt', color: '#0BDA50' },
                { range: '0.5 – 0.7', label: 'Tốt', color: '#84CC16' },
                { range: '0.3 – 0.5', label: 'Trung bình', color: '#F59E0B' },
                { range: '< 0.3', label: 'Kém / Cần chú ý', color: '#EF4444' },
              ].map(item => (
                <View key={item.range} style={styles.scaleRow}>
                  <View style={[styles.scaleDot, { backgroundColor: item.color }]} />
                  <Text style={styles.scaleRange}>{item.range}</Text>
                  <Text style={[styles.scaleLabel, { color: item.color }]}>{item.label}</Text>
                </View>
              ))}
            </View>

            <View style={{ height: 32 }} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// Sub-components
const IndexToggleBtn = ({ label, icon, id, active, onPress, color }: any) => {
  const isActive = active === id;
  return (
    <TouchableOpacity
      style={[styles.toggleBtn, isActive && { backgroundColor: color, borderColor: color }]}
      onPress={() => onPress(id)}
    >
      <Ionicons name={icon} size={16} color={isActive ? '#fff' : colors.textMutedLight} />
      <Text style={[styles.toggleBtnText, isActive && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
};

const MetricCard = ({ icon, color, label, value, sub }: any) => (
  <View style={styles.metricCard}>
    <View style={[styles.metricIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricSub}>{sub}</Text>
  </View>
);

const DetailRow = ({ label, value, last }: any) => (
  <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8F6' },

  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { marginRight: 12, padding: 2 },
  refreshBtn: { padding: 4 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.textLight },
  headerSub: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMutedLight, marginTop: 1 },

  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: fonts.medium, color: colors.textMutedLight, marginTop: 16 },

  chipsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMutedLight, marginLeft: 6 },
  chipTextActive: { color: '#fff' },

  mapCard: { height: 240, marginHorizontal: 16, marginBottom: 0, borderRadius: 20, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  map: { ...StyleSheet.absoluteFillObject },
  mapOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)', padding: 14 },
  mapOverlayName: { fontFamily: fonts.bold, fontSize: 16, color: '#fff' },
  mapOverlaySub: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  body: { padding: 16 },

  toggleRow: { flexDirection: 'row', marginBottom: 16, gap: 10 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB' },
  toggleBtnText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textMutedLight, marginLeft: 6 },

  valueCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderLeftWidth: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  valueCardLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMutedLight, marginBottom: 4 },
  valueCardNum: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 48 },
  valueCardUnit: { fontSize: 20 },
  valueCardSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMutedLight, marginTop: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, maxWidth: 140 },
  statusBadgeText: { fontFamily: fonts.semiBold, fontSize: 12, marginLeft: 4, flexShrink: 1 },

  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textLight, marginBottom: 20 },

  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.textLight, marginBottom: 12 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  metricCard: { width: '47.5%', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  metricIcon: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  metricValue: { fontFamily: fonts.bold, fontSize: 22, color: colors.textLight, marginBottom: 4 },
  metricLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textLight },
  metricSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMutedLight, marginTop: 2, textAlign: 'center' },

  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  detailLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMutedLight },
  detailValue: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.textLight },

  scaleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  scaleDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  scaleRange: { fontFamily: fonts.medium, fontSize: 13, color: colors.textLight, width: 80 },
  scaleLabel: { fontFamily: fonts.semiBold, fontSize: 13 },
});
