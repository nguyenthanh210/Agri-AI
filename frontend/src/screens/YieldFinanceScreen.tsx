import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import apiClient from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { LinearGradient } from 'expo-linear-gradient';

export default function YieldFinanceScreen({ navigation }: any) {
  const token = useAuthStore(state => state.token);
  const [cropType, setCropType] = useState('Lúa nước');
  const [areaHa, setAreaHa] = useState('1');
  const [seedCost, setSeedCost] = useState('5000000');
  const [fertilizerCost, setFertilizerCost] = useState('10000000');
  const [laborCost, setLaborCost] = useState('8000000');
  const [expectedPrice, setExpectedPrice] = useState('8000');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('vi-VN') + ' đ';
  };

  const handlePredict = async () => {
    if (!cropType || !areaHa || !seedCost || !fertilizerCost || !laborCost || !expectedPrice) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ các thông tin!');
      return;
    }
    
    setLoading(true);
    try {
      const response = await apiClient.post('/ai/yield-finance', {
        crop_type: cropType,
        area_ha: parseFloat(areaHa),
        seed_cost: parseInt(seedCost, 10),
        fertilizer_cost: parseInt(fertilizerCost, 10),
        labor_cost: parseInt(laborCost, 10),
        expected_price_per_kg: parseInt(expectedPrice, 10)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResult(response.data);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể kết nối với AI. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dự báo & Tài chính</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!result ? (
          <View style={styles.inputCard}>
            <Text style={styles.cardTitle}>Nhập dữ liệu canh tác</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Loại cây trồng</Text>
              <TextInput style={styles.input} value={cropType} onChangeText={setCropType} placeholder="VD: Lúa nước, Sầu riêng..." />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Diện tích (ha)</Text>
              <TextInput style={styles.input} value={areaHa} onChangeText={setAreaHa} keyboardType="numeric" placeholder="VD: 1.5" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Chi phí hạt giống (VNĐ)</Text>
              <TextInput style={styles.input} value={seedCost} onChangeText={setSeedCost} keyboardType="numeric" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Chi phí phân bón/thuốc (VNĐ)</Text>
              <TextInput style={styles.input} value={fertilizerCost} onChangeText={setFertilizerCost} keyboardType="numeric" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Chi phí nhân công (VNĐ)</Text>
              <TextInput style={styles.input} value={laborCost} onChangeText={setLaborCost} keyboardType="numeric" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Giá bán dự kiến (VNĐ/kg)</Text>
              <TextInput style={styles.input} value={expectedPrice} onChangeText={setExpectedPrice} keyboardType="numeric" />
            </View>

            <TouchableOpacity 
              style={styles.predictButton} 
              onPress={handlePredict}
              disabled={loading}
            >
              <LinearGradient
                colors={['#10b981', '#059669']}
                style={styles.gradientButton}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="analytics-outline" size={20} color={colors.white} style={{ marginRight: 8 }} />
                    <Text style={styles.predictButtonText}>Phân tích ngay</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.resultContainer}>
            <LinearGradient colors={['#f8fafc', '#f1f5f9']} style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryIcon}>
                  <Ionicons name="leaf-outline" size={24} color="#10b981" />
                </View>
                <View style={styles.summaryText}>
                  <Text style={styles.summaryLabel}>Sản lượng dự báo</Text>
                  <Text style={styles.summaryValue}>{result.predicted_yield_tons} Tấn</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.financeGrid}>
              <View style={[styles.financeCard, { borderTopColor: '#ef4444' }]}>
                <Text style={styles.financeLabel}>Tổng chi phí</Text>
                <Text style={[styles.financeValue, { color: '#ef4444' }]}>{formatCurrency(result.total_cost_vnd)}</Text>
              </View>
              <View style={[styles.financeCard, { borderTopColor: '#3b82f6' }]}>
                <Text style={styles.financeLabel}>Doanh thu dự kiến</Text>
                <Text style={[styles.financeValue, { color: '#3b82f6' }]}>{formatCurrency(result.expected_revenue_vnd)}</Text>
              </View>
            </View>

            <LinearGradient 
              colors={result.expected_profit_vnd > 0 ? ['#ecfdf5', '#d1fae5'] : ['#fef2f2', '#fee2e2']} 
              style={styles.profitCard}
            >
              <Text style={styles.profitLabel}>Lợi nhuận dự kiến</Text>
              <Text style={[styles.profitValue, { color: result.expected_profit_vnd > 0 ? '#059669' : '#dc2626' }]}>
                {formatCurrency(result.expected_profit_vnd)}
              </Text>
              <View style={styles.profitBadge}>
                <Ionicons 
                  name={result.expected_profit_vnd > 0 ? "trending-up" : "trending-down"} 
                  size={16} 
                  color={result.expected_profit_vnd > 0 ? "#059669" : "#dc2626"} 
                />
                <Text style={[styles.profitBadgeText, { color: result.expected_profit_vnd > 0 ? '#059669' : '#dc2626' }]}>
                  {result.expected_profit_vnd > 0 ? "Khả quan" : "Rủi ro"}
                </Text>
              </View>
            </LinearGradient>

            <View style={styles.adviceCard}>
              <Text style={styles.adviceTitle}>Lời khuyên từ AI</Text>
              {result.financial_advice.map((adv: string, index: number) => (
                <View key={index} style={styles.adviceRow}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={styles.adviceIcon} />
                  <Text style={styles.adviceText}>{adv}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.resetButton}
              onPress={() => setResult(null)}
            >
              <Text style={styles.resetButtonText}>Tính toán lại</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.primary,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.white,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 30,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
  },
  predictButton: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  predictButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
  },
  resultContainer: {
    paddingBottom: 40,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  summaryText: {
    flex: 1,
  },
  summaryLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textLight,
  },
  summaryValue: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: '#059669',
  },
  financeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  financeCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderTopWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginHorizontal: 4,
  },
  financeLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textLight,
    marginBottom: 8,
  },
  financeValue: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  profitCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  profitLabel: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textLight,
    marginBottom: 8,
  },
  profitValue: {
    fontFamily: fonts.bold,
    fontSize: 28,
    marginBottom: 12,
  },
  profitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  profitBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    marginLeft: 4,
  },
  adviceCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  adviceTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
  },
  adviceRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  adviceIcon: {
    marginTop: 2,
    marginRight: 12,
  },
  adviceText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  resetButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.primary,
  }
});
