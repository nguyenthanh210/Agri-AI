import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, Animated, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BarChart } from 'react-native-gifted-charts';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import apiClient from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { calculatePolygonArea } from '../utils/area';

const { width } = Dimensions.get('window');

interface FarmData {
  id: number;
  name: string;
  area: number;
  crop_type: string;
  status: string;
  ndvi: number;
}

export default function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  
  const [farms, setFarms] = useState<FarmData[]>([]);
  const [loading, setLoading] = useState(true);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    const fetchFarms = async () => {
      try {
        const res = await apiClient.get('/farms/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Mock data thêm NDVI và Status vì backend chưa trả về đủ
        const enrichedFarms = res.data.map((f: any) => {
          const poly = (f.coordinates || []).map((c: any) => ({ latitude: c.lat, longitude: c.lng }));
          return {
            ...f,
            area: f.area_size || calculatePolygonArea(poly),
            ndvi: 0.65 + Math.random() * 0.2,
            status: Math.random() > 0.8 ? 'Cần nước' : 'Khỏe mạnh'
          };
        });
        setFarms(enrichedFarms);
      } catch (error) {
        console.log('Error fetching farms', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFarms();
  }, [token]);

  const totalArea = farms.reduce((sum, f) => sum + (f.area || 0), 0);
  const avgNDVI = farms.length > 0 ? farms.reduce((sum, f) => sum + f.ndvi, 0) / farms.length : 0;
  const warnings = farms.filter(f => f.status !== 'Khỏe mạnh').length;

  const soilMoistureData = [
    { value: 65, label: 'T2' },
    { value: 59, label: 'T3' },
    { value: 80, label: 'T4', frontColor: '#3B82F6' },
    { value: 81, label: 'T5' },
    { value: 56, label: 'T6', frontColor: '#FBBF24' },
    { value: 55, label: 'T7', frontColor: '#FBBF24' },
    { value: 40, label: 'CN', frontColor: '#EF4444' },
  ];

  if (loading) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.ScrollView 
        contentContainerStyle={styles.container}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Dashboard</Text>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={16} color={colors.textMutedLight} />
            <Text style={styles.subtitle}>Cập nhật: {new Date().toLocaleDateString('vi-VN')}</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <TouchableOpacity style={[styles.statCard, { width: '47.5%' }]} onPress={() => navigation.navigate('FarmingLog')}>
            <View style={[styles.iconWrapper, { backgroundColor: `${colors.primary}1A` }]}>
              <Ionicons name="book" size={24} color={colors.primary} />
            </View>
            <View style={styles.statInfo}>
              <Text style={styles.statLabel}>Nhật ký</Text>
              <Text style={[styles.statValue, { fontSize: 16 }]}>Ghi chép</Text>
            </View>
          </TouchableOpacity>
          <StatCard icon="map" color="#3B82F6" label="Diện tích" value={totalArea.toFixed(1)} unit="ha" />
          <StatCard icon="analytics" color="#10B981" label="NDVI TB" value={avgNDVI.toFixed(2)} unit="" />
          <StatCard icon="warning" color="#FBBF24" label="Cảnh báo" value={`${warnings}`} unit="vùng" />
        </View>

        {/* Weather Gradient Card */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('MenuTab')}>
          <LinearGradient
            colors={['#0BDA50', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.weatherCard}
          >
            <View style={styles.weatherHeader}>
              <Ionicons name="sunny" size={24} color="#fff" />
              <Text style={styles.weatherTitle}>Thời tiết hiện tại</Text>
            </View>
            
            <View style={styles.weatherBody}>
              <View>
                <Text style={styles.temperatureText}>28.5°C</Text>
                <Text style={styles.conditionText}>Trời nắng, có mây</Text>
              </View>
              <MaterialCommunityIcons name="weather-partly-cloudy" size={64} color="#fff" />
            </View>

            <View style={styles.weatherFooter}>
              <WeatherDetail icon="water" label="Độ ẩm" value="75%" />
              <WeatherDetail icon="umbrella" label="Lượng mưa" value="0mm" />
              <WeatherDetail icon="water" label="Độ ẩm đất" value="62%" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Farm Status List */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tình trạng vùng trồng</Text>
            <TouchableOpacity><Text style={styles.seeAllText}>Xem tất cả</Text></TouchableOpacity>
          </View>
          {farms.slice(0, 3).map((farm, index) => (
            <View key={farm.id} style={[styles.farmItem, index !== 2 && styles.farmBorder]}>
              <View style={[styles.dot, { backgroundColor: farm.status === 'Khỏe mạnh' ? colors.primary : '#FBBF24' }]} />
              <View style={styles.farmInfo}>
                <Text style={styles.farmName}>{farm.name}</Text>
                <Text style={styles.farmMeta}>{farm.area} ha • {farm.crop_type}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: farm.status === 'Khỏe mạnh' ? 'rgba(11,218,80,0.1)' : 'rgba(251,191,36,0.1)' }]}>
                <Text style={[styles.statusText, { color: farm.status === 'Khỏe mạnh' ? colors.primary : '#D97706' }]}>
                  {farm.status}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Soil Moisture Chart */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Độ ẩm đất (7 ngày)</Text>
          <View style={{ marginTop: 24 }}>
            <BarChart
              data={soilMoistureData}
              frontColor={colors.primary}
              barWidth={24}
              initialSpacing={16}
              spacing={20}
              barBorderRadius={6}
              hideRules
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor="#E5E7EB"
              yAxisTextStyle={{ color: colors.textMutedLight, fontSize: 11 }}
              xAxisLabelTextStyle={{ color: colors.textMutedLight, fontSize: 11, fontFamily: fonts.medium }}
              height={180}
            />
          </View>
        </View>
        <View style={{height: 100}}/>
      </Animated.ScrollView>

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('AiChat')}
      >
        <MaterialCommunityIcons name="robot-outline" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ----------------- Sub Components -----------------

const StatCard = ({ icon, color, label, value, unit }: any) => (
  <View style={styles.statCard}>
    <View style={[styles.iconWrapper, { backgroundColor: `${color}1A` }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <View style={styles.statInfo}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Text style={styles.statValue}>{value}</Text>
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </View>
    </View>
  </View>
);

const WeatherDetail = ({ icon, label, value }: any) => (
  <View style={styles.weatherDetail}>
    <MaterialCommunityIcons name={icon} size={20} color="#fff" />
    <Text style={styles.weatherDetailLabel}>{label}</Text>
    <Text style={styles.weatherDetailValue}>{value}</Text>
  </View>
);

// ----------------- Styles -----------------

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.backgroundLight },
  container: { padding: 24 },
  header: { marginBottom: 24 },
  title: { fontFamily: fonts.bold, fontSize: 32, color: colors.textLight, letterSpacing: -1 },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  subtitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMutedLight, marginLeft: 6 },
  
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  statCard: { width: '47.5%', backgroundColor: colors.surfaceLight, borderRadius: 16, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F0F5F1' },
  iconWrapper: { padding: 10, borderRadius: 12, marginRight: 12 },
  statInfo: { flex: 1 },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMutedLight },
  statValue: { fontFamily: fonts.bold, fontSize: 20, color: colors.textLight, marginTop: 2 },
  statUnit: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMutedLight, marginBottom: 3 },

  weatherCard: { borderRadius: 16, padding: 24, marginBottom: 24, shadowColor: '#0BDA50', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  weatherHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  weatherTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: '#fff', marginLeft: 8 },
  weatherBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  temperatureText: { fontFamily: fonts.bold, fontSize: 44, color: '#fff' },
  conditionText: { fontFamily: fonts.medium, fontSize: 16, color: '#fff', opacity: 0.9 },
  weatherFooter: { flexDirection: 'row', justifyContent: 'space-around' },
  weatherDetail: { alignItems: 'center' },
  weatherDetailLabel: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  weatherDetailValue: { fontFamily: fonts.bold, fontSize: 15, color: '#fff', marginTop: 2 },

  sectionCard: { backgroundColor: colors.surfaceLight, borderRadius: 16, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F0F5F1' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.textLight },
  seeAllText: { fontFamily: fonts.medium, fontSize: 14, color: colors.primary },
  
  farmItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  farmBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F5F1' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  farmInfo: { flex: 1 },
  farmName: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.textLight },
  farmMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMutedLight, marginTop: 4 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontFamily: fonts.semiBold, fontSize: 12 },

  fab: { position: 'absolute', bottom: 24, right: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
});
