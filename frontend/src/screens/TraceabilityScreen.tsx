import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import apiClient from '../api/client';

export default function TraceabilityScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const qrCodeId = route.params?.qrCodeId;
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (qrCodeId) {
      fetchTraceabilityData();
    } else {
      setLoading(false);
    }
  }, [qrCodeId]);

  const fetchTraceabilityData = async () => {
    try {
      const res = await apiClient.get(`/traceability/${qrCodeId}`);
      setData(res.data);
    } catch (error) {
      console.log('Error fetching traceability data', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.textLight} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.medium, color: colors.textMutedLight }}>Không tìm thấy thông tin truy xuất nguồn gốc</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Truy Xuất Nguồn Gốc</Text>
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.heroCard}>
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.verifiedText}>Đã xác thực bởi OmniFarm</Text>
          </View>
          <Text style={styles.farmName}>{data.farm_name}</Text>
          <Text style={styles.batchName}>{data.batch.name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Giống: {data.batch.seed_type}</Text>
            <Text style={styles.metaText}>Trạng thái: {data.batch.status === 'active' ? 'Đang trồng' : 'Đã thu hoạch'}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Hành trình canh tác</Text>
        <View style={styles.timelineContainer}>
          {data.logs.map((log: any, index: number) => (
            <View key={log.id} style={styles.timelineItem}>
              <View style={styles.timelineLine} />
              <View style={styles.timelineDot}>
                <Ionicons 
                  name={
                    log.activity_type === 'Gieo hạt' ? 'leaf' : 
                    log.activity_type === 'Tưới nước' ? 'water' :
                    log.activity_type === 'Thu hoạch' ? 'basket' : 'calendar'
                  } 
                  size={14} color="#fff" 
                />
              </View>
              <View style={styles.timelineContent}>
                <View style={styles.logHeader}>
                  <Text style={styles.logType}>{log.activity_type}</Text>
                  <Text style={styles.logDate}>{new Date(log.created_at).toLocaleDateString('vi-VN')}</Text>
                </View>
                {log.description ? <Text style={styles.logDesc}>{log.description}</Text> : null}
              </View>
            </View>
          ))}
          {data.logs.length === 0 && (
             <Text style={{ fontFamily: fonts.regular, color: colors.textMutedLight, textAlign: 'center', marginTop: 20 }}>
               Chưa có dữ liệu nhật ký.
             </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: colors.primary, paddingTop: 40 },
  backBtn: { marginRight: 16 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 20, color: '#fff' },
  
  container: { flex: 1 },
  heroCard: { backgroundColor: colors.primary, padding: 24, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingBottom: 40 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  verifiedText: { fontFamily: fonts.medium, color: '#fff', fontSize: 12, marginLeft: 6 },
  farmName: { fontFamily: fonts.medium, fontSize: 16, color: 'rgba(255,255,255,0.9)', marginBottom: 4 },
  batchName: { fontFamily: fonts.bold, fontSize: 28, color: '#fff', marginBottom: 16 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { fontFamily: fonts.medium, fontSize: 14, color: '#fff' },

  sectionTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.textLight, marginHorizontal: 24, marginTop: 24, marginBottom: 16 },
  timelineContainer: { paddingHorizontal: 24, paddingBottom: 40 },
  timelineItem: { flexDirection: 'row', marginBottom: 24 },
  timelineLine: { position: 'absolute', left: 15, top: 30, bottom: -30, width: 2, backgroundColor: '#E5E7EB' },
  timelineDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  timelineContent: { marginLeft: 16, flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logType: { fontFamily: fonts.bold, fontSize: 16, color: colors.textLight },
  logDate: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMutedLight },
  logDesc: { fontFamily: fonts.regular, fontSize: 14, color: '#4B5563', marginTop: 8, lineHeight: 20 },
});
