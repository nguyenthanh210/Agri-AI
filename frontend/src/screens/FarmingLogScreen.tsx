import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import apiClient from '../api/client';
import { useAuthStore } from '../store/useAuthStore';

export default function FarmingLogScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const token = useAuthStore(state => state.token);
  
  const [farms, setFarms] = useState<any[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activityType, setActivityType] = useState('Gieo hạt');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchFarms();
  }, []);

  const fetchFarms = async () => {
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
        fetchLogs(res.data[0].id);
      }
    } catch (error) {
      console.log('Error fetching batches', error);
    }
  };

  const fetchLogs = async (batchId: number) => {
    try {
      const res = await apiClient.get(`/farming/batches/${batchId}/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(res.data);
    } catch (error) {
      console.log('Error fetching logs', error);
    }
  };

  const handleAddLog = async () => {
    if (!selectedBatch) return;
    try {
      await apiClient.post(`/farming/batches/${selectedBatch.id}/logs`, {
        activity_type: activityType,
        description: description
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert('Thành công', 'Đã thêm nhật ký nông vụ!');
      setDescription('');
      fetchLogs(selectedBatch.id);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể thêm nhật ký');
    }
  };

  const handleCreateBatch = async () => {
    if (!selectedFarm) return;
    try {
      await apiClient.post(`/farming/farms/${selectedFarm.id}/batches`, {
        name: `Lô mới ${new Date().toLocaleDateString('vi-VN')}`,
        seed_type: 'Không xác định',
        status: 'active'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchBatches(selectedFarm.id);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tạo lô mới');
    }
  };

  if (loading) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textLight} />
        </TouchableOpacity>
        <Text style={styles.title}>Nhật ký nông vụ</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
        {farms.length > 0 ? (
          <>
            <View style={styles.farmTitleRow}>
              <Ionicons name="location" size={20} color={colors.primary} />
              <Text style={styles.farmTitleText}>Vùng trồng: {selectedFarm?.name}</Text>
            </View>
            
            <View style={styles.card}>
              <Text style={styles.label}>Lô canh tác đang chọn:</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.batchScroll}
                contentContainerStyle={{ paddingRight: 20, alignItems: 'center' }}
              >
                {batches.map(b => (
                  <TouchableOpacity 
                    key={b.id} 
                    style={[styles.batchChip, selectedBatch?.id === b.id && styles.batchChipActive]}
                    onPress={() => {
                      setSelectedBatch(b);
                      fetchLogs(b.id);
                    }}
                  >
                    <Text style={[styles.batchChipText, selectedBatch?.id === b.id && styles.batchChipTextActive]}>
                      {b.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.addBatchBtn} onPress={handleCreateBatch}>
                  <Ionicons name="add" size={18} color={colors.primary} />
                  <Text style={styles.addBatchBtnText}>Tạo lô</Text>
                </TouchableOpacity>
              </ScrollView>
              
              {selectedBatch && (
                <View style={styles.qrSection}>
                   <View style={styles.qrInfo}>
                     <Text style={styles.qrLabel}>Mã truy xuất (ID):</Text>
                     <Text style={styles.qrCodeText}>{selectedBatch.qr_code_id.substring(0,8)}...</Text>
                   </View>
                   <TouchableOpacity 
                      style={styles.traceBtn}
                      onPress={() => navigation.navigate('Traceability', { qrCodeId: selectedBatch.qr_code_id })}
                   >
                     <Ionicons name="qr-code" size={16} color="#fff" style={{ marginRight: 6 }} />
                     <Text style={styles.traceBtnText}>Mã QR</Text>
                   </TouchableOpacity>
                </View>
              )}
            </View>

            {selectedBatch && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="create-outline" size={20} color={colors.textLight} />
                  <Text style={styles.cardTitle}>Thêm hoạt động mới</Text>
                </View>
                
                <View style={styles.typeChipsContainer}>
                  {['Gieo hạt', 'Tưới nước', 'Bón phân', 'Phun thuốc', 'Thu hoạch'].map(type => (
                    <TouchableOpacity 
                      key={type} 
                      style={[styles.typeChip, activityType === type && styles.typeChipActive]}
                      onPress={() => setActivityType(type)}
                    >
                      <Text style={[styles.typeChipText, activityType === type && styles.typeChipTextActive]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                <TextInput
                  style={styles.input}
                  placeholder="Mô tả chi tiết (ví dụ: bón 5kg NPK, tưới 10 lít nước...)"
                  placeholderTextColor={colors.textMutedLight}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />
                
                <TouchableOpacity style={styles.submitBtn} onPress={handleAddLog} activeOpacity={0.8}>
                  <Ionicons name="save-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Lưu Nhật Ký</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.timelineSection}>
              <View style={styles.cardHeader}>
                <Ionicons name="time-outline" size={20} color={colors.textLight} />
                <Text style={styles.cardTitle}>Lịch sử hoạt động</Text>
              </View>

              {logs.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="document-text-outline" size={48} color="#E5E7EB" />
                  <Text style={styles.emptyStateText}>Chưa có hoạt động nào được ghi nhận.</Text>
                </View>
              )}
              
              {logs.map((log, index) => {
                const isLast = index === logs.length - 1;
                return (
                  <View key={log.id} style={styles.timelineItem}>
                    {!isLast && <View style={styles.timelineLine} />}
                    <View style={styles.timelineDot}>
                      <Ionicons 
                        name={
                          log.activity_type === 'Gieo hạt' ? 'leaf' : 
                          log.activity_type === 'Tưới nước' ? 'water' :
                          log.activity_type === 'Thu hoạch' ? 'basket' : 'checkmark'
                        } 
                        size={12} color="#fff" 
                      />
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeaderRow}>
                        <Text style={styles.logType}>{log.activity_type}</Text>
                        <Text style={styles.logDate}>{new Date(log.created_at).toLocaleDateString('vi-VN')} {new Date(log.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</Text>
                      </View>
                      {log.description ? <Text style={styles.logDesc}>{log.description}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="leaf-outline" size={64} color="#E5E7EB" />
            <Text style={[styles.emptyStateText, { marginTop: 16, fontSize: 16 }]}>Bạn chưa có vùng trồng nào.</Text>
            <Text style={[styles.emptyStateText, { marginTop: 8 }]}>Hãy tạo vùng trồng trên hệ thống web hoặc liên hệ quản trị viên.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7F5' }, // Slightly off-white for better contrast with cards
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16, backgroundColor: '#fff' },
  backBtn: { marginRight: 16, padding: 4 },
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.textLight },
  container: { padding: 20 },
  
  farmTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  farmTitleText: { fontFamily: fonts.bold, fontSize: 18, color: colors.textLight, marginLeft: 8 },
  
  card: { 
    backgroundColor: '#fff', 
    padding: 20, 
    borderRadius: 20, 
    marginBottom: 20, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 12, 
    elevation: 2 
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.textLight, marginLeft: 8 },
  
  label: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMutedLight, marginBottom: 12 },
  
  batchScroll: { marginHorizontal: -20, paddingHorizontal: 20 }, // allow horizontal scroll to edge but start at padding
  batchChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, backgroundColor: '#F3F6F4', marginRight: 10, borderWidth: 1, borderColor: '#E8EFEA' },
  batchChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  batchChipText: { fontFamily: fonts.medium, color: '#6B7280', fontSize: 14 },
  batchChipTextActive: { color: '#fff' },
  
  addBatchBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', backgroundColor: 'rgba(11, 218, 80, 0.05)' },
  addBatchBtnText: { color: colors.primary, fontFamily: fonts.medium, fontSize: 14, marginLeft: 4 },
  
  qrSection: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#F3F6F4', paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qrInfo: { flex: 1 },
  qrLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMutedLight },
  qrCodeText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textLight, marginTop: 2 },
  traceBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  traceBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: 13 },

  typeChipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }, // 'gap' works on newer React Native versions, else fallback to margins
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#F3F6F4', borderWidth: 1, borderColor: 'transparent', margin: 4 },
  typeChipActive: { backgroundColor: 'rgba(11, 218, 80, 0.1)', borderColor: colors.primary },
  typeChipText: { fontFamily: fonts.medium, fontSize: 14, color: '#6B7280' },
  typeChipTextActive: { color: colors.primary, fontFamily: fonts.bold },
  
  input: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16, fontFamily: fonts.regular, fontSize: 15, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E5E7EB', color: colors.textLight },
  
  submitBtn: { flexDirection: 'row', backgroundColor: colors.primary, borderRadius: 16, padding: 16, justifyContent: 'center', alignItems: 'center', marginTop: 16, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },

  timelineSection: { marginTop: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  emptyStateText: { fontFamily: fonts.medium, color: colors.textMutedLight, textAlign: 'center', marginTop: 12, paddingHorizontal: 20, lineHeight: 22 },
  
  timelineItem: { flexDirection: 'row', marginBottom: 0, paddingBottom: 20 },
  timelineLine: { position: 'absolute', left: 13, top: 28, bottom: 0, width: 2, backgroundColor: '#E5E7EB' },
  timelineDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, marginTop: 0, zIndex: 1, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#F4F7F5' },
  timelineContent: { marginLeft: 16, flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1, borderWidth: 1, borderColor: '#F3F6F4' },
  timelineHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  logType: { fontFamily: fonts.bold, fontSize: 16, color: colors.textLight },
  logDate: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMutedLight },
  logDesc: { fontFamily: fonts.regular, fontSize: 14, color: '#4B5563', lineHeight: 20 },
});
