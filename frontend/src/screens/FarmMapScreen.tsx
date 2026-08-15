import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, TextInput, Alert, ScrollView, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { MapType, Polygon, Marker, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import { colors, fonts } from '../theme';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import apiClient from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { calculatePolygonArea } from '../utils/area';

const { width, height } = Dimensions.get('window');

interface Farm {
  id: string;
  name: string;
  cropType: string;
  polygon: Array<{ latitude: number; longitude: number }>;
  area: number;
  ndvi: number;
  moisture: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────
const getCropColor = (cropType: string) => {
  if (cropType?.includes('Lúa')) return colors.primary;
  if (cropType?.toLowerCase().includes('cà phê')) return '#8B4513';
  if (cropType?.includes('Ngô')) return '#F59E0B';
  return '#3B82F6';
};
const getNdviColor = (v: number) => {
  if (v >= 0.7) return '#0BDA50';
  if (v >= 0.5) return '#84CC16';
  if (v >= 0.3) return '#F59E0B';
  return '#EF4444';
};
const getNdviLabel = (v: number) => {
  if (v >= 0.7) return 'Rất tốt';
  if (v >= 0.5) return 'Tốt';
  if (v >= 0.3) return 'Trung bình';
  return 'Kém';
};

// mock trend (replace with API later)
const NDVI_TREND = [
  { value: 0.42 }, { value: 0.50 }, { value: 0.63 }, { value: 0.71 }, { value: 0.68 }, { value: 0.75 },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function FarmMapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const mapRef = useRef<MapView>(null);
  const token = useAuthStore(state => state.token);

  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState<MapType>('hybrid');
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Drawing states
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawnCoordinates, setDrawnCoordinates] = useState<any[]>([]);

  // Modals
  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [newFarmName, setNewFarmName] = useState('');
  const [newFarmCrop, setNewFarmCrop] = useState('');
  const [editFarmName, setEditFarmName] = useState('');
  const [editFarmCrop, setEditFarmCrop] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Bottom sheet for map view
  const sheetPosition = useRef(new Animated.Value(300)).current;

  // ── Data Fetching ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchFarms();
    requestLocation();
  }, []);

  const fetchFarms = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/farms/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const formatted: Farm[] = res.data.map((f: any) => {
        const poly = (f.coordinates || []).map((c: any) => ({ latitude: c.lat, longitude: c.lng }));
        return {
          id: f.id.toString(),
          name: f.name,
          cropType: f.crop_type || 'Chưa xác định',
          polygon: poly,
          area: f.area_size || calculatePolygonArea(poly),
          ndvi: parseFloat((0.55 + Math.random() * 0.3).toFixed(2)),   // placeholder
          moisture: Math.round(55 + Math.random() * 25),               // placeholder
        };
      });
      setFarms(formatted);
    } catch (error) {
      console.log('Error fetching farms:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let location = await Location.getCurrentPositionAsync({});
      setUserLocation(location.coords);
      mapRef.current?.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (e) { /* ignore */ }
  };

  // ── Sheet animation ───────────────────────────────────────────────────────
  const toggleSheet = (show: boolean) => {
    Animated.spring(sheetPosition, {
      toValue: show ? 0 : 300,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  // ── Select farm (from map or list) ───────────────────────────────────────
  const handleSelectFarm = (farm: Farm) => {
    setSelectedFarm(farm);
    if (viewMode === 'map') {
      toggleSheet(true);
      // fly to farm centroid
      if (farm.polygon.length > 0) {
        const lat = farm.polygon.reduce((s, c) => s + c.latitude, 0) / farm.polygon.length;
        const lng = farm.polygon.reduce((s, c) => s + c.longitude, 0) / farm.polygon.length;
        mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.008, longitudeDelta: 0.008 });
      }
    }
  };

  // ── Drawing ───────────────────────────────────────────────────────────────
  const handleMapPress = (e: MapPressEvent) => {
    if (isDrawing) {
      const coord = e.nativeEvent.coordinate;
      setDrawnCoordinates(prev => [...prev, coord]);
    } else {
      setSelectedFarm(null);
      toggleSheet(false);
    }
  };

  // ── Save New Farm ─────────────────────────────────────────────────────────
  const handleSaveFarm = async () => {
    if (!newFarmName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên vùng trồng');
      return;
    }
    if (drawnCoordinates.length < 3) {
      Alert.alert('Lỗi', 'Cần ít nhất 3 điểm để tạo vùng trồng');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: newFarmName,
        crop_type: newFarmCrop || null,
        area_size: calculatePolygonArea(drawnCoordinates),
        coordinates: drawnCoordinates.map((c: any) => ({ lat: c.latitude, lng: c.longitude })),
      };
      const res = await apiClient.post('/farms/', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newFarm: Farm = {
        id: res.data.id.toString(),
        name: res.data.name,
        cropType: res.data.crop_type || 'Chưa xác định',
        polygon: (res.data.coordinates || []).map((c: any) => ({ latitude: c.lat, longitude: c.lng })),
        area: res.data.area_size || calculatePolygonArea(drawnCoordinates),
        ndvi: 0.70,
        moisture: 65,
      };
      setFarms(prev => [...prev, newFarm]);
      setIsSaveModalVisible(false);
      setIsDrawing(false);
      setDrawnCoordinates([]);
      setNewFarmName('');
      setNewFarmCrop('');
      Alert.alert('✅ Thành công', 'Đã thêm vùng trồng mới!');
    } catch (error: any) {
      Alert.alert('Lỗi', error.response?.data?.detail || 'Không thể lưu vùng trồng');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Edit Farm ─────────────────────────────────────────────────────────────
  const openEditModal = () => {
    if (!selectedFarm) return;
    setEditFarmName(selectedFarm.name);
    setEditFarmCrop(selectedFarm.cropType);
    setIsEditModalVisible(true);
  };

  const handleEditFarm = async () => {
    if (!selectedFarm || !editFarmName.trim()) return;
    setIsSaving(true);
    try {
      await apiClient.put(`/farms/${selectedFarm.id}`, { name: editFarmName, crop_type: editFarmCrop }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updated: Farm = { ...selectedFarm, name: editFarmName, cropType: editFarmCrop };
      setFarms(prev => prev.map(f => f.id === selectedFarm.id ? updated : f));
      setSelectedFarm(updated);
      setIsEditModalVisible(false);
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật vùng trồng');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete Farm ───────────────────────────────────────────────────────────
  const handleDeleteFarm = () => {
    if (!selectedFarm) return;
    Alert.alert('Xác nhận xóa', `Xóa vùng trồng "${selectedFarm.name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa', style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/farms/${selectedFarm.id}`, { headers: { Authorization: `Bearer ${token}` } });
            setFarms(prev => prev.filter(f => f.id !== selectedFarm.id));
            setSelectedFarm(null);
            toggleSheet(false);
          } catch {
            Alert.alert('Lỗi', 'Không thể xóa vùng trồng');
          }
        }
      }
    ]);
  };

  // ── Renders ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Bản đồ nông trại</Text>
          <Text style={styles.headerSubtitle}>
            {loading ? 'Đang tải...' : `${farms.length} vùng đang quản lý`}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {loading && <ActivityIndicator color={colors.primary} style={{ marginRight: 12 }} />}
          {/* View mode toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, viewMode === 'map' && styles.modeBtnActive]}
              onPress={() => setViewMode('map')}
            >
              <Ionicons name="map-outline" size={18} color={viewMode === 'map' ? '#fff' : colors.textMutedLight} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, viewMode === 'list' && styles.modeBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons name="list-outline" size={18} color={viewMode === 'list' ? '#fff' : colors.textMutedLight} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── MAP VIEW ── */}
      {viewMode === 'map' && (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            mapType={mapType}
            initialRegion={{ latitude: 10.034, longitude: 105.784, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            onPress={handleMapPress}
          >
            {farms.map(farm =>
              farm.polygon.length >= 3 ? (
                <React.Fragment key={farm.id}>
                  <Polygon
                    coordinates={farm.polygon}
                    fillColor={getCropColor(farm.cropType) + (selectedFarm?.id === farm.id ? '66' : '33')}
                    strokeColor={selectedFarm?.id === farm.id ? '#fff' : getCropColor(farm.cropType)}
                    strokeWidth={selectedFarm?.id === farm.id ? 3 : 2}
                    tappable
                    onPress={() => { if (!isDrawing) handleSelectFarm(farm); }}
                  />
                  <Marker
                    coordinate={{
                      latitude: farm.polygon.reduce((s, c) => s + c.latitude, 0) / farm.polygon.length,
                      longitude: farm.polygon.reduce((s, c) => s + c.longitude, 0) / farm.polygon.length,
                    }}
                    onPress={() => { if (!isDrawing) handleSelectFarm(farm); }}
                  >
                    <View style={[styles.markerBubble, { backgroundColor: getCropColor(farm.cropType) }]}>
                      <Text style={styles.markerNdvi}>{farm.ndvi.toFixed(2)}</Text>
                    </View>
                  </Marker>
                </React.Fragment>
              ) : null
            )}

            {/* Drawing preview */}
            {isDrawing && drawnCoordinates.length > 0 && (
              <React.Fragment>
                <Polygon
                  coordinates={drawnCoordinates}
                  fillColor="rgba(11, 218, 80, 0.3)"
                  strokeColor={colors.primary}
                  strokeWidth={3}
                />
                {drawnCoordinates.map((coord: any, i: number) => (
                  <Marker key={`dp-${i}`} coordinate={coord}>
                    <View style={styles.drawPoint} />
                  </Marker>
                ))}
              </React.Fragment>
            )}
          </MapView>

          {/* Drawing toolbar */}
          {isDrawing && (
            <View style={styles.drawingOverlay}>
              <View style={styles.drawingBadge}>
                <Ionicons name="git-commit-outline" size={18} color="#fff" />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={styles.drawingTitle}>Đang vẽ vùng trồng</Text>
                  <Text style={styles.drawingDesc}>{drawnCoordinates.length} điểm · Cần ≥ 3</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row' }}>
                {drawnCoordinates.length >= 3 && (
                  <TouchableOpacity style={styles.drawActionBtn} onPress={() => setIsSaveModalVisible(true)}>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
                {drawnCoordinates.length > 0 && (
                  <TouchableOpacity style={[styles.drawActionBtn, { backgroundColor: '#fff', marginHorizontal: 6 }]} onPress={() => setDrawnCoordinates(prev => prev.slice(0, -1))}>
                    <Ionicons name="arrow-undo" size={20} color={colors.primary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.drawActionBtn, { backgroundColor: '#fff' }]} onPress={() => { setIsDrawing(false); setDrawnCoordinates([]); }}>
                  <Ionicons name="close" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Floating controls */}
          {!isDrawing && (
            <View style={styles.floatingControls}>
              <TouchableOpacity style={styles.floatingBtn} onPress={() => setMapType(prev => prev === 'hybrid' ? 'standard' : 'hybrid')}>
                <Ionicons name="layers-outline" size={20} color={colors.textLight} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.floatingBtn} onPress={requestLocation}>
                <Ionicons name="locate" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* FAB */}
          {!isDrawing && !selectedFarm && (
            <TouchableOpacity style={styles.fab} onPress={() => { setIsDrawing(true); toggleSheet(false); }}>
              <Ionicons name="add" size={22} color="#fff" />
              <Text style={styles.fabText}>Vẽ Vùng Trồng</Text>
            </TouchableOpacity>
          )}

          {/* Bottom Sheet */}
          {!isDrawing && (
            <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetPosition }] }]}>
              {selectedFarm
                ? <FarmDetailSheet
                    farm={selectedFarm}
                    onClose={() => { setSelectedFarm(null); toggleSheet(false); }}
                    onEdit={openEditModal}
                    onDelete={handleDeleteFarm}
                    onOpenSatellite={() => navigation.navigate('Satellite', { farmId: selectedFarm.id })}
                  />
                : <EmptySheet onDraw={() => { setIsDrawing(true); toggleSheet(false); }} />
              }
            </Animated.View>
          )}
        </View>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === 'list' && (
        <FlatList
          data={farms}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.emptyState}>
                <Ionicons name="leaf-outline" size={64} color={colors.textMutedLight} />
                <Text style={styles.emptyTitle}>Chưa có vùng trồng</Text>
                <Text style={styles.emptyDesc}>Chuyển sang chế độ Bản đồ và vẽ vùng đầu tiên!</Text>
              </View>
            )
          }
          renderItem={({ item: farm }) => (
            <FarmListCard
              farm={farm}
              isSelected={selectedFarm?.id === farm.id}
              onPress={() => setSelectedFarm(prev => prev?.id === farm.id ? null : farm)}
              onOpenSatellite={() => navigation.navigate('Satellite', { farmId: farm.id })}
              onEdit={() => {
                setSelectedFarm(farm);
                setEditFarmName(farm.name);
                setEditFarmCrop(farm.cropType);
                setIsEditModalVisible(true);
              }}
              onDelete={() => {
                setSelectedFarm(farm);
                handleDeleteFarm();
              }}
            />
          )}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}

      {/* ── Modals ── */}
      <FarmModal
        visible={isSaveModalVisible}
        title="Lưu vùng trồng mới"
        subtitle={`${drawnCoordinates.length} điểm đã vẽ`}
        name={newFarmName}
        crop={newFarmCrop}
        onChangeName={setNewFarmName}
        onChangeCrop={setNewFarmCrop}
        onCancel={() => setIsSaveModalVisible(false)}
        onSave={handleSaveFarm}
        isSaving={isSaving}
      />
      <FarmModal
        visible={isEditModalVisible}
        title="Chỉnh sửa vùng trồng"
        name={editFarmName}
        crop={editFarmCrop}
        onChangeName={setEditFarmName}
        onChangeCrop={setEditFarmCrop}
        onCancel={() => setIsEditModalVisible(false)}
        onSave={handleEditFarm}
        isSaving={isSaving}
        saveLabel="Cập nhật"
      />
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FarmDetailSheet({ farm, onClose, onEdit, onDelete, onOpenSatellite }: any) {
  const ndviColor = getNdviColor(farm.ndvi);
  return (
    <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.sheetHandle} />
      {/* Header */}
      <View style={styles.sheetHeader}>
        <View style={[styles.sheetIconBox, { backgroundColor: getCropColor(farm.cropType) + '20' }]}>
          <Ionicons name="leaf" size={26} color={getCropColor(farm.cropType)} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.farmName}>{farm.name}</Text>
          <Text style={styles.farmMeta}>{farm.cropType}{farm.area > 0 ? ` • ${farm.area} ha` : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity style={styles.iconBtn} onPress={onEdit}>
            <Ionicons name="pencil-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { marginLeft: 6 }]} onPress={onDelete}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { marginLeft: 6 }]} onPress={onClose}>
            <Ionicons name="close" size={18} color={colors.textMutedLight} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { borderLeftColor: ndviColor, borderLeftWidth: 3 }]}>
          <Text style={styles.statBoxLabel}>Chỉ số NDVI</Text>
          <Text style={[styles.statBoxValue, { color: ndviColor }]}>{farm.ndvi.toFixed(2)}</Text>
          <View style={[styles.statBadge, { backgroundColor: ndviColor + '20' }]}>
            <Text style={[styles.statBadgeText, { color: ndviColor }]}>{getNdviLabel(farm.ndvi)}</Text>
          </View>
        </View>
        <View style={[styles.statBox, { borderLeftColor: '#3B82F6', borderLeftWidth: 3 }]}>
          <Text style={styles.statBoxLabel}>Độ ẩm đất</Text>
          <Text style={[styles.statBoxValue, { color: '#3B82F6' }]}>{farm.moisture}%</Text>
          <View style={[styles.statBadge, { backgroundColor: '#3B82F620' }]}>
            <Text style={[styles.statBadgeText, { color: '#3B82F6' }]}>
              {farm.moisture >= 60 ? 'Đủ nước' : 'Cần tưới'}
            </Text>
          </View>
        </View>
      </View>

      {/* NDVI Trend */}
      <View style={styles.chartBox}>
        <Text style={styles.chartBoxTitle}>Xu hướng NDVI – 6 tháng</Text>
        <LineChart
          data={NDVI_TREND}
          width={width - 100}
          height={120}
          color={ndviColor}
          thickness={2.5}
          dataPointsColor={ndviColor}
          dataPointsRadius={4}
          hideRules
          hideYAxisText
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor="#F0F0F0"
          curved
          isAnimated
        />
      </View>

      {/* Environmental metrics */}
      <View style={styles.envRow}>
        <EnvItem icon="thermometer-outline" color="#F59E0B" label="Nhiệt bề mặt" value="28°C" />
        <EnvItem icon="cloud-outline" color="#64748B" label="Độ che mây" value="12%" />
        <EnvItem icon="sunny-outline" color="#F97316" label="Bức xạ UV" value="6.2" />
      </View>

      {/* CTA */}
      <TouchableOpacity style={styles.satelliteBtn} onPress={onOpenSatellite}>
        <Ionicons name="planet-outline" size={20} color="#fff" />
        <Text style={styles.satelliteBtnText}>Xem phân tích vệ tinh đầy đủ</Text>
        <Ionicons name="chevron-forward" size={18} color="#fff" />
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function EmptySheet({ onDraw }: any) {
  return (
    <View style={styles.sheetEmpty}>
      <View style={styles.sheetHandle} />
      <Text style={styles.farmName}>Vùng trồng của bạn</Text>
      <Text style={[styles.farmMeta, { marginBottom: 16 }]}>Bấm vào một vùng trên bản đồ để xem chỉ số</Text>
      <TouchableOpacity style={styles.addFarmBtn} onPress={onDraw}>
        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.addFarmBtnText}>Vẽ vùng trồng mới</Text>
      </TouchableOpacity>
    </View>
  );
}

function FarmListCard({ farm, isSelected, onPress, onOpenSatellite, onEdit, onDelete }: any) {
  const ndviColor = getNdviColor(farm.ndvi);
  return (
    <View style={styles.listCard}>
      {/* Card Header */}
      <TouchableOpacity style={styles.listCardHeader} onPress={onPress} activeOpacity={0.8}>
        <View style={[styles.listCardIconBox, { backgroundColor: getCropColor(farm.cropType) + '20' }]}>
          <Ionicons name="leaf" size={22} color={getCropColor(farm.cropType)} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.listCardName}>{farm.name}</Text>
          <Text style={styles.listCardMeta}>{farm.cropType}{farm.area > 0 ? ` • ${farm.area} ha` : ''}</Text>
        </View>
        <View style={[styles.ndviBadge, { backgroundColor: ndviColor + '20' }]}>
          <Text style={[styles.ndviValue, { color: ndviColor }]}>{farm.ndvi.toFixed(2)}</Text>
          <Text style={[styles.ndviLabel, { color: ndviColor }]}>NDVI</Text>
        </View>
        <Ionicons
          name={isSelected ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMutedLight}
          style={{ marginLeft: 8 }}
        />
      </TouchableOpacity>

      {/* Expanded detail */}
      {isSelected && (
        <View style={styles.listCardDetail}>
          {/* Metrics */}
          <View style={styles.listMetricsRow}>
            <ListMetric icon="leaf" color={ndviColor} label="NDVI" value={farm.ndvi.toFixed(2)} sub={getNdviLabel(farm.ndvi)} />
            <ListMetric icon="water" color="#3B82F6" label="Độ ẩm" value={`${farm.moisture}%`} sub={farm.moisture >= 60 ? 'Đủ nước' : 'Cần tưới'} />
            <ListMetric icon="thermometer" color="#F59E0B" label="Nhiệt độ" value="28°C" sub="Bề mặt" />
          </View>

          {/* Trend chart */}
          <Text style={styles.chartBoxTitle}>Xu hướng NDVI – 6 tháng</Text>
          <LineChart
            data={NDVI_TREND}
            width={width - 100}
            height={110}
            color={ndviColor}
            thickness={2}
            dataPointsColor={ndviColor}
            dataPointsRadius={4}
            hideRules
            hideYAxisText
            yAxisThickness={0}
            xAxisThickness={1}
            xAxisColor="#F0F0F0"
            curved
            isAnimated
          />

          {/* Actions */}
          <View style={styles.listCardActions}>
            <TouchableOpacity style={styles.listActionBtn} onPress={onEdit}>
              <Ionicons name="pencil-outline" size={16} color={colors.primary} />
              <Text style={[styles.listActionText, { color: colors.primary }]}>Sửa</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.listActionBtn, { backgroundColor: '#FEF2F2' }]} onPress={onDelete}>
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text style={[styles.listActionText, { color: '#EF4444' }]}>Xóa</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.listActionBtn, { flex: 1, backgroundColor: colors.primary }]} onPress={onOpenSatellite}>
              <Ionicons name="planet-outline" size={16} color="#fff" />
              <Text style={[styles.listActionText, { color: '#fff' }]}>Vệ tinh đầy đủ</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function ListMetric({ icon, color, label, value, sub }: any) {
  return (
    <View style={styles.listMetricBox}>
      <View style={[styles.listMetricIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.listMetricValue, { color }]}>{value}</Text>
      <Text style={styles.listMetricLabel}>{label}</Text>
      <Text style={styles.listMetricSub}>{sub}</Text>
    </View>
  );
}

function EnvItem({ icon, color, label, value }: any) {
  return (
    <View style={styles.envItem}>
      <View style={[styles.envIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.envValue}>{value}</Text>
      <Text style={styles.envLabel}>{label}</Text>
    </View>
  );
}

function FarmModal({ visible, title, subtitle, name, crop, onChangeName, onChangeCrop, onCancel, onSave, isSaving, saveLabel = 'Lưu vùng trồng' }: any) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          {subtitle && <Text style={styles.modalSubtitle}>{subtitle}</Text>}
          <TextInput style={styles.input} placeholder="Tên vùng trồng (VD: Vùng lúa A2)" value={name} onChangeText={onChangeName} placeholderTextColor={colors.textMutedLight} />
          <TextInput style={styles.input} placeholder="Loại cây trồng (VD: Lúa, Ngô)" value={crop} onChangeText={onChangeCrop} placeholderTextColor={colors.textMutedLight} />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onCancel}>
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSaveBtn} onPress={onSave} disabled={isSaving}>
              {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalSaveText}>{saveLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 24, color: colors.textLight },
  headerSubtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMutedLight, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  modeToggle: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 3 },
  modeBtn: { width: 36, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  modeBtnActive: { backgroundColor: colors.primary },

  // MAP
  mapContainer: { flex: 1, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  markerBubble: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, borderWidth: 1.5, borderColor: '#fff', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  markerNdvi: { fontFamily: fonts.bold, fontSize: 11, color: '#fff' },
  drawPoint: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', borderWidth: 3, borderColor: colors.primary },

  drawingOverlay: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', zIndex: 20 },
  drawingBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, marginRight: 8, elevation: 6, shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 6 },
  drawingTitle: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  drawingDesc: { fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.9)' },
  drawActionBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },

  floatingControls: { position: 'absolute', right: 14, top: 14, alignItems: 'center' },
  floatingBtn: { width: 44, height: 44, backgroundColor: '#fff', borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 10, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6 },

  fab: { position: 'absolute', bottom: 24, alignSelf: 'center', backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 22, borderRadius: 28, elevation: 6, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, zIndex: 10 },
  fabText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff', marginLeft: 8 },

  // BOTTOM SHEET
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: height * 0.65, shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 12, zIndex: 10 },
  sheetScroll: { padding: 20 },
  sheetEmpty: { padding: 20, paddingBottom: 40 },
  sheetHandle: { width: 44, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  sheetIconBox: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  farmName: { fontFamily: fonts.bold, fontSize: 20, color: colors.textLight },
  farmMeta: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMutedLight, marginTop: 2 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },

  statsRow: { flexDirection: 'row', marginBottom: 18, gap: 12 },
  statBox: { flex: 1, backgroundColor: '#F8FAF8', borderRadius: 16, padding: 14 },
  statBoxLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMutedLight, marginBottom: 4 },
  statBoxValue: { fontFamily: fonts.bold, fontSize: 28, marginBottom: 6 },
  statBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  statBadgeText: { fontFamily: fonts.semiBold, fontSize: 11 },

  chartBox: { backgroundColor: '#F8FAF8', borderRadius: 16, padding: 16, marginBottom: 16 },
  chartBoxTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.textLight, marginBottom: 14 },

  envRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  envItem: { flex: 1, alignItems: 'center' },
  envIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  envValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.textLight },
  envLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMutedLight, textAlign: 'center', marginTop: 2 },

  satelliteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16 },
  satelliteBtnText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff', marginHorizontal: 8, flex: 1, textAlign: 'center' },

  addFarmBtn: { flexDirection: 'row', borderRadius: 14, paddingVertical: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', backgroundColor: '#F0FBF3' },
  addFarmBtnText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary, marginLeft: 8 },

  // LIST VIEW
  listContent: { padding: 16, paddingTop: 12 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.textLight, marginTop: 16 },
  emptyDesc: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMutedLight, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },

  listCard: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  listCardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  listCardIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  listCardName: { fontFamily: fonts.bold, fontSize: 16, color: colors.textLight },
  listCardMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMutedLight, marginTop: 2 },
  ndviBadge: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  ndviValue: { fontFamily: fonts.bold, fontSize: 16 },
  ndviLabel: { fontFamily: fonts.medium, fontSize: 10, marginTop: 1 },

  listCardDetail: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  listMetricsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, gap: 8 },
  listMetricBox: { flex: 1, alignItems: 'center' },
  listMetricIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  listMetricValue: { fontFamily: fonts.bold, fontSize: 18 },
  listMetricLabel: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.textLight, marginTop: 2 },
  listMetricSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMutedLight, marginTop: 1, textAlign: 'center' },

  listCardActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  listActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.primary + '15' },
  listActionText: { fontFamily: fonts.semiBold, fontSize: 13, marginLeft: 6 },

  // MODALS
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 48 },
  modalTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.textLight, marginBottom: 6 },
  modalSubtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMutedLight, marginBottom: 18 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, fontFamily: fonts.medium, fontSize: 15, marginBottom: 14, color: colors.textLight },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  modalCancelBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  modalCancelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textMutedLight },
  modalSaveBtn: { backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, minWidth: 120, alignItems: 'center' },
  modalSaveText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },
});
