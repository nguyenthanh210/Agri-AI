import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  FlatList, RefreshControl, ActivityIndicator, Animated,
  Dimensions, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import { colors, fonts } from '../theme';
import apiClient from '../api/client';
import { useAuthStore } from '../store/useAuthStore';

const { width } = Dimensions.get('window');

// ── Types ─────────────────────────────────────────────────────────────────────
interface Commodity {
  id: string;
  name: string;
  unit: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  category: string;
  minPrice?: number;
  maxPrice?: number;
  avgPrice?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all', label: 'Tất cả', icon: 'apps' },
  { key: 'grains', label: 'Ngũ cốc', icon: 'nutrition' },
  { key: 'vegetables', label: 'Rau củ', icon: 'leaf' },
  { key: 'fruits', label: 'Trái cây', icon: 'color-fill' },
  { key: 'coffee', label: 'Cà phê', icon: 'cafe' },
  { key: 'livestock', label: 'Chăn nuôi', icon: 'paw' },
];

const CAT_COLORS: Record<string, string> = {
  all: '#6366F1',
  grains: '#F59E0B',
  vegetables: '#10B981',
  fruits: '#F97316',
  coffee: '#92400E',
  livestock: '#EC4899',
};

const MOCK_DATA: Commodity[] = [
  { id: '1', name: 'Lúa tẻ thường', unit: 'kg', currentPrice: 6200, priceChange: 150, priceChangePercent: 2.48, category: 'grains', minPrice: 5800, maxPrice: 6400, avgPrice: 6100 },
  { id: '2', name: 'Gạo 5451', unit: 'kg', currentPrice: 14500, priceChange: -200, priceChangePercent: -1.36, category: 'grains', minPrice: 14000, maxPrice: 15200, avgPrice: 14600 },
  { id: '3', name: 'Ngô hạt', unit: 'kg', currentPrice: 8800, priceChange: 200, priceChangePercent: 2.33, category: 'grains', minPrice: 8200, maxPrice: 9100, avgPrice: 8700 },
  { id: '4', name: 'Cà chua', unit: 'kg', currentPrice: 25000, priceChange: 3000, priceChangePercent: 13.64, category: 'vegetables', minPrice: 18000, maxPrice: 30000, avgPrice: 23000 },
  { id: '5', name: 'Khoai tây', unit: 'kg', currentPrice: 18000, priceChange: 0, priceChangePercent: 0, category: 'vegetables', minPrice: 16000, maxPrice: 20000, avgPrice: 17500 },
  { id: '6', name: 'Hành tây', unit: 'kg', currentPrice: 20000, priceChange: 1500, priceChangePercent: 8.11, category: 'vegetables', minPrice: 15000, maxPrice: 22000, avgPrice: 18500 },
  { id: '7', name: 'Dưa hấu', unit: 'kg', currentPrice: 15000, priceChange: -1000, priceChangePercent: -6.25, category: 'fruits', minPrice: 12000, maxPrice: 18000, avgPrice: 15500 },
  { id: '8', name: 'Xoài cát Hòa Lộc', unit: 'kg', currentPrice: 45000, priceChange: 2000, priceChangePercent: 4.65, category: 'fruits', minPrice: 40000, maxPrice: 55000, avgPrice: 47000 },
  { id: '9', name: 'Thanh long ruột đỏ', unit: 'kg', currentPrice: 28000, priceChange: -3000, priceChangePercent: -9.68, category: 'fruits', minPrice: 22000, maxPrice: 35000, avgPrice: 29000 },
  { id: '10', name: 'Cà phê Robusta', unit: 'kg', currentPrice: 125000, priceChange: 3000, priceChangePercent: 2.46, category: 'coffee', minPrice: 110000, maxPrice: 130000, avgPrice: 120000 },
  { id: '11', name: 'Cà phê Arabica', unit: 'kg', currentPrice: 185000, priceChange: -2000, priceChangePercent: -1.07, category: 'coffee', minPrice: 170000, maxPrice: 200000, avgPrice: 185000 },
  { id: '12', name: 'Heo hơi', unit: 'kg', currentPrice: 62000, priceChange: 1000, priceChangePercent: 1.64, category: 'livestock', minPrice: 58000, maxPrice: 65000, avgPrice: 61000 },
  { id: '13', name: 'Gà lông trắng', unit: 'kg', currentPrice: 38000, priceChange: 500, priceChangePercent: 1.33, category: 'livestock', minPrice: 35000, maxPrice: 42000, avgPrice: 38500 },
];

// Generate mock 30-day price history
const genHistory = (base: number, percent: number) =>
  Array.from({ length: 30 }, (_, i) => ({
    value: base * (0.9 + 0.2 * Math.sin(i / 5) + Math.random() * 0.05),
  }));

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtPrice = (p: number) =>
  p >= 1000
    ? p.toLocaleString('vi-VN') + ' ₫'
    : p.toLocaleString('vi-VN') + ' ₫';

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function MarketScreen() {
  const token = useAuthStore(state => state.token);
  const [data, setData] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCat, setSelectedCat] = useState('all');
  const [selectedItem, setSelectedItem] = useState<Commodity | null>(null);

  // summary stats
  const rising = data.filter(d => d.priceChangePercent > 0).length;
  const falling = data.filter(d => d.priceChangePercent < 0).length;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await apiClient.get('/commodity-prices/', { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.commodities?.length > 0) {
        const mapped: Commodity[] = res.data.commodities.map((item: any) => ({
          id: item.id.toString(),
          name: item.name,
          unit: item.unit || 'kg',
          currentPrice: item.current_price,
          priceChange: item.price_change_24h || 0,
          priceChangePercent: item.price_change_percent_24h || 0,
          category: item.category || 'other',
          minPrice: item.min_price,
          maxPrice: item.max_price,
          avgPrice: item.avg_price,
        }));
        setData(mapped);
      } else {
        setData(MOCK_DATA);
      }
    } catch {
      setData(MOCK_DATA);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filtered = selectedCat === 'all' ? data : data.filter(d => d.category === selectedCat);
  const catColor = CAT_COLORS[selectedCat] || colors.primary;

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Đang tải thị trường...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header ── */}
      <LinearGradient colors={['#fff', '#F6F8F6']} style={styles.headerGrad}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Thị trường</Text>
            <Text style={styles.headerDate}>
              <Ionicons name="time-outline" size={12} color={colors.textMutedLight} />{' '}
              Cập nhật {new Date().toLocaleDateString('vi-VN')}
            </Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRefreshing(true); loadData(); }}>
            <Ionicons name="refresh" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Summary pills */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="trending-up" size={14} color="#16A34A" />
            <Text style={[styles.summaryPillText, { color: '#16A34A' }]}>{rising} tăng giá</Text>
          </View>
          <View style={[styles.summaryPill, { backgroundColor: '#FEF2F2' }]}>
            <Ionicons name="trending-down" size={14} color="#DC2626" />
            <Text style={[styles.summaryPillText, { color: '#DC2626' }]}>{falling} giảm giá</Text>
          </View>
          <View style={[styles.summaryPill, { backgroundColor: '#F3F4F6' }]}>
            <Ionicons name="remove" size={14} color="#6B7280" />
            <Text style={[styles.summaryPillText, { color: '#6B7280' }]}>{data.length - rising - falling} ổn định</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Category Tabs ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catsRow}>
        {CATEGORIES.map(cat => {
          const isActive = selectedCat === cat.key;
          const cColor = CAT_COLORS[cat.key];
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.catChip, isActive && { backgroundColor: cColor, borderColor: cColor }]}
              onPress={() => setSelectedCat(cat.key)}
            >
              <Ionicons name={cat.icon as any} size={14} color={isActive ? '#fff' : cColor} />
              <Text style={[styles.catChipText, isActive && { color: '#fff' }]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Table Header ── */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Tên hàng hóa</Text>
        <Text style={[styles.tableHeaderCell, { width: 120, textAlign: 'right' }]}>Giá hiện tại</Text>
        <Text style={[styles.tableHeaderCell, { width: 80, textAlign: 'center' }]}>Thay đổi</Text>
      </View>

      {/* ── Data List ── */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <CommodityRow item={item} onPress={() => setSelectedItem(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={56} color={colors.textMutedLight} />
            <Text style={styles.emptyText}>Không có dữ liệu cho danh mục này</Text>
          </View>
        }
        contentContainerStyle={styles.listContainer}
      />

      {/* ── Detail Modal ── */}
      <Modal visible={!!selectedItem} transparent animationType="slide" onRequestClose={() => setSelectedItem(null)}>
        {selectedItem && (
          <CommodityDetail item={selectedItem} onClose={() => setSelectedItem(null)} />
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ── Commodity Row ─────────────────────────────────────────────────────────────
function CommodityRow({ item, onPress }: { item: Commodity; onPress: () => void }) {
  const isUp = item.priceChangePercent > 0;
  const isDown = item.priceChangePercent < 0;
  const tColor = isUp ? '#16A34A' : isDown ? '#DC2626' : '#6B7280';
  const bgColor = isUp ? '#DCFCE7' : isDown ? '#FEF2F2' : '#F3F4F6';

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {/* Icon */}
      <View style={[styles.rowIcon, { backgroundColor: (CAT_COLORS[item.category] || colors.primary) + '18' }]}>
        <Ionicons
          name={item.category === 'grains' ? 'nutrition' : item.category === 'fruits' ? 'color-fill' : item.category === 'coffee' ? 'cafe' : item.category === 'livestock' ? 'paw' : 'leaf'}
          size={18}
          color={CAT_COLORS[item.category] || colors.primary}
        />
      </View>

      {/* Name */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.rowUnit}>/{item.unit}</Text>
      </View>

      {/* Price */}
      <View style={{ width: 120, alignItems: 'flex-end' }}>
        <Text style={styles.rowPrice}>{fmtPrice(item.currentPrice)}</Text>
        {item.priceChange !== 0 && (
          <Text style={[styles.rowAbsChange, { color: tColor }]}>
            {isUp ? '+' : ''}{item.priceChange.toLocaleString('vi-VN')} ₫
          </Text>
        )}
      </View>

      {/* % badge */}
      <View style={[styles.pctBadge, { backgroundColor: bgColor, width: 72 }]}>
        <Ionicons
          name={isUp ? 'trending-up' : isDown ? 'trending-down' : 'remove'}
          size={11}
          color={tColor}
        />
        <Text style={[styles.pctText, { color: tColor }]}>
          {isUp ? '+' : ''}{item.priceChangePercent.toFixed(2)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Commodity Detail ──────────────────────────────────────────────────────────
function CommodityDetail({ item, onClose }: { item: Commodity; onClose: () => void }) {
  const isUp = item.priceChangePercent > 0;
  const isDown = item.priceChangePercent < 0;
  const tColor = isUp ? '#16A34A' : isDown ? '#DC2626' : '#6B7280';
  const catColor = CAT_COLORS[item.category] || colors.primary;
  const history = genHistory(item.currentPrice, item.priceChangePercent);

  return (
    <View style={styles.detailOverlay}>
      <TouchableOpacity style={styles.detailBg} onPress={onClose} />
      <View style={styles.detailSheet}>
        {/* Handle */}
        <View style={styles.detailHandle} />

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.detailHeader}>
            <View style={[styles.detailIconCircle, { backgroundColor: catColor + '20' }]}>
              <Ionicons name="trending-up" size={28} color={catColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailName}>{item.name}</Text>
              <Text style={styles.detailUnit}>Đơn vị: {item.unit}</Text>
            </View>
            <TouchableOpacity style={styles.detailCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.textMutedLight} />
            </TouchableOpacity>
          </View>

          {/* Price Hero */}
          <View style={[styles.priceHeroCard, { borderLeftColor: tColor }]}>
            <Text style={styles.priceHeroLabel}>Giá hiện tại</Text>
            <Text style={styles.priceHeroValue}>{fmtPrice(item.currentPrice)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <Ionicons
                name={isUp ? 'trending-up' : isDown ? 'trending-down' : 'remove'}
                size={18}
                color={tColor}
              />
              <Text style={[styles.priceHeroChange, { color: tColor }]}>
                {' '}{isUp ? '+' : ''}{item.priceChange.toLocaleString('vi-VN')} ₫  ({isUp ? '+' : ''}{item.priceChangePercent.toFixed(2)}%)
              </Text>
              <Text style={styles.priceHeroSub}> so với hôm qua</Text>
            </View>
          </View>

          {/* 30-day chart */}
          <View style={styles.chartCard}>
            <Text style={styles.chartCardTitle}>Biểu đồ giá – 30 ngày qua</Text>
            <LineChart
              data={history}
              width={width - 96}
              height={140}
              color={tColor}
              thickness={2.5}
              dataPointsColor={tColor}
              dataPointsRadius={3}
              hideRules
              hideYAxisText
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor="#F0F0F0"
              curved
              isAnimated
              startFillColor={tColor}
              endFillColor={'#fff'}
              startOpacity={0.15}
              endOpacity={0}
              areaChart
            />
          </View>

          {/* Price range stats */}
          <View style={styles.statsGrid}>
            <StatBox label="Thấp nhất" value={fmtPrice(item.minPrice ?? item.currentPrice * 0.9)} color="#3B82F6" />
            <StatBox label="Trung bình" value={fmtPrice(item.avgPrice ?? item.currentPrice)} color="#8B5CF6" />
            <StatBox label="Cao nhất" value={fmtPrice(item.maxPrice ?? item.currentPrice * 1.1)} color="#F59E0B" />
          </View>

          {/* Info table */}
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Thông tin thị trường</Text>
            <InfoRow label="Danh mục" value={CATEGORIES.find(c => c.key === item.category)?.label ?? item.category} />
            <InfoRow label="Đơn vị" value={item.unit} />
            <InfoRow label="Biến động 24h" value={`${isUp ? '+' : ''}${item.priceChangePercent.toFixed(2)}%`} valueColor={tColor} />
            <InfoRow label="Nguồn" value="Cục Thống kê Nông nghiệp" last />
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statBox, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value, valueColor, last }: { label: string; value: string; valueColor?: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor, fontFamily: fonts.bold } : {}]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMutedLight, marginTop: 16 },

  headerGrad: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 28, color: colors.textLight },
  headerDate: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMutedLight, marginTop: 2 },
  refreshBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F0FBF3', justifyContent: 'center', alignItems: 'center' },

  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 4 },
  summaryPillText: { fontFamily: fonts.semiBold, fontSize: 12 },

  catsRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', gap: 5 },
  catChipText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textMutedLight },

  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F8F9FA', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EEEEEE' },
  tableHeaderCell: { fontFamily: fonts.semiBold, fontSize: 12, color: '#9CA3AF', letterSpacing: 0.3 },

  separator: { height: 1, backgroundColor: '#F5F5F5', marginLeft: 70 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowIcon: { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  rowName: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.textLight },
  rowUnit: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMutedLight, marginTop: 1 },
  rowPrice: { fontFamily: fonts.bold, fontSize: 15, color: colors.textLight },
  rowAbsChange: { fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },
  pctBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 5, paddingHorizontal: 6, borderRadius: 8, gap: 2, marginLeft: 8 },
  pctText: { fontFamily: fonts.bold, fontSize: 12 },

  listContainer: { paddingBottom: 32 },
  emptyState: { paddingVertical: 80, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMutedLight, marginTop: 16 },

  // Detail Modal
  detailOverlay: { flex: 1, justifyContent: 'flex-end' },
  detailBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  detailSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 0 },
  detailHandle: { width: 44, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  detailIconCircle: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  detailName: { fontFamily: fonts.bold, fontSize: 20, color: colors.textLight },
  detailUnit: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMutedLight, marginTop: 2 },
  detailCloseBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },

  priceHeroCard: { backgroundColor: '#F8FAF8', borderRadius: 18, padding: 20, marginBottom: 16, borderLeftWidth: 5 },
  priceHeroLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMutedLight, marginBottom: 4 },
  priceHeroValue: { fontFamily: fonts.bold, fontSize: 32, color: colors.textLight },
  priceHeroChange: { fontFamily: fonts.bold, fontSize: 15 },
  priceHeroSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMutedLight },

  chartCard: { backgroundColor: '#F8FAF8', borderRadius: 18, padding: 18, marginBottom: 16 },
  chartCardTitle: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.textLight, marginBottom: 16 },

  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMutedLight, marginBottom: 6 },
  statValue: { fontFamily: fonts.bold, fontSize: 15 },

  infoCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, marginBottom: 16 },
  infoCardTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textLight, marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  infoLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMutedLight },
  infoValue: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.textLight },
});
