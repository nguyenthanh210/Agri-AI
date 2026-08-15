import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView, ScrollView, ActivityIndicator, Alert, Animated } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import apiClient from '../api/client';
import { useAuthStore } from '../store/useAuthStore';

interface AnalysisResult {
  className: string;
  confidence: number;
  description?: string;
  symptoms?: string[];
  treatment?: string[];
  prevention?: string[];
  severity?: string;
}


const formatDiseaseName = (className: string) => {
  if (!className) return 'Bệnh đốm lá (Mặc định)';
  
  const dict: Record<string, string> = {
    'Apple___Apple_scab': 'Bệnh vảy (Táo)',
    'Apple___Black_rot': 'Bệnh thối đen (Táo)',
    'Apple___Cedar_apple_rust': 'Bệnh gỉ sắt sừng hươu (Táo)',
    'Apple___healthy': 'Khỏe mạnh (Táo)',
    'Blueberry___healthy': 'Khỏe mạnh (Việt quất)',
    'Cherry_(including_sour)___Powdery_mildew': 'Bệnh phấn trắng (Anh đào)',
    'Cherry_(including_sour)___healthy': 'Khỏe mạnh (Anh đào)',
    'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot': 'Bệnh đốm xám (Ngô)',
    'Corn_(maize)___Common_rust_': 'Bệnh gỉ sắt (Ngô)',
    'Corn_(maize)___Northern_Leaf_Blight': 'Bệnh cháy lá (Ngô)',
    'Corn_(maize)___healthy': 'Khỏe mạnh (Ngô)',
    'Grape___Black_rot': 'Bệnh thối đen (Nho)',
    'Grape___Esca_(Black_Measles)': 'Bệnh đốm đen Esca (Nho)',
    'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)': 'Bệnh bạc lá (Nho)',
    'Grape___healthy': 'Khỏe mạnh (Nho)',
    'Orange___Haunglongbing_(Citrus_greening)': 'Bệnh vàng lá gân xanh (Cam)',
    'Peach___Bacterial_spot': 'Bệnh đốm vi khuẩn (Đào)',
    'Peach___healthy': 'Khỏe mạnh (Đào)',
    'Pepper,_bell___Bacterial_spot': 'Bệnh đốm vi khuẩn (Ớt chuông)',
    'Pepper,_bell___healthy': 'Khỏe mạnh (Ớt chuông)',
    'Potato___Early_blight': 'Bệnh mốc sương sớm (Khoai tây)',
    'Potato___Late_blight': 'Bệnh mốc sương muộn (Khoai tây)',
    'Potato___healthy': 'Khỏe mạnh (Khoai tây)',
    'Raspberry___healthy': 'Khỏe mạnh (Mâm xôi)',
    'Soybean___healthy': 'Khỏe mạnh (Đậu nành)',
    'Squash___Powdery_mildew': 'Bệnh phấn trắng (Bí)',
    'Strawberry___Leaf_scorch': 'Bệnh cháy lá (Dâu tây)',
    'Strawberry___healthy': 'Khỏe mạnh (Dâu tây)',
    'Tomato___Bacterial_spot': 'Bệnh đốm vi khuẩn (Cà chua)',
    'Tomato___Early_blight': 'Bệnh đốm vòng (Cà chua)',
    'Tomato___Late_blight': 'Bệnh mốc sương (Cà chua)',
    'Tomato___Leaf_Mold': 'Bệnh nấm lá (Cà chua)',
    'Tomato___Septoria_leaf_spot': 'Bệnh đốm lá Septoria (Cà chua)',
    'Tomato___Spider_mites Two-spotted_spider_mite': 'Nhện đỏ (Cà chua)',
    'Tomato___Target_Spot': 'Bệnh đốm vòng Target Spot (Cà chua)',
    'Tomato___Tomato_Yellow_Leaf_Curl_Virus': 'Bệnh xoăn lá vàng (Cà chua)',
    'Tomato___Tomato_mosaic_virus': 'Bệnh khảm lá (Cà chua)',
    'Tomato___healthy': 'Khỏe mạnh (Cà chua)',
  };

  return dict[className] || className.replace(/___/g, ' - ').replace(/_/g, ' ');
};

const analyzeImageFn = async (image: string, token: string | null): Promise<AnalysisResult> => {
  const formData = new FormData();
  formData.append('file', {
    uri: image,
    name: 'plant.jpg',
    type: 'image/jpeg',
  } as any);

  const res = await apiClient.post('/disease-detection/predict', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${token}`,
    },
  });

  const dummyData: AnalysisResult = {
        className: formatDiseaseName(res.data.class || ''),
        confidence: res.data.confidence || 0.95,
        description: 'Bệnh do nấm gây ra, thường xuất hiện ở môi trường ẩm ướt, thiếu ánh sáng.',
        symptoms: ['Xuất hiện đốm nâu trên lá', 'Lá chuyển vàng và rụng sớm', 'Cây phát triển chậm'],
        treatment: ['Cắt bỏ lá bệnh', 'Phun thuốc diệt nấm sinh học', 'Tăng cường bón Kali'],
        prevention: ['Giữ khoảng cách trồng hợp lý', 'Tránh tưới nước vào buổi tối', 'Luân canh cây trồng'],
    severity: (res.data.confidence || 0.95) > 0.9 ? 'Cao' : 'Trung bình'
  };

  return dummyData;
};

export default function DiseaseScanScreen() {
  const token = useAuthStore(state => state.token);
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const rotation = new Animated.Value(0);

  const startRotation = () => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  };

  const pickImage = async (useCamera: boolean = false) => {
    let permissionResult;
    if (useCamera) {
      permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    } else {
      permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
    if (permissionResult.granted === false) {
      Alert.alert('Quyền truy cập bị từ chối', 'Vui lòng cấp quyền để sử dụng tính năng này.');
      return;
    }
    let pickerResult = useCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.8 });
    if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
      setImage(pickerResult.assets[0].uri);
      setResult(null);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    startRotation();
    try {
      const data = await analyzeImageFn(image, token);
      setResult(data);
    } catch (error) {
      console.log('Analysis error', error);
      Alert.alert('Lỗi', 'Không thể phân tích hình ảnh lúc này.');
    } finally {
      setIsAnalyzing(false);
      rotation.stopAnimation();
    }
  };

  const getSeverityColor = (severity: string = '') => {
    switch(severity.toLowerCase()) {
      case 'thấp': return colors.primary;
      case 'trung bình': return '#FFA000';
      case 'cao': return '#FF5252';
      default: return '#FFA000';
    }
  };

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Header Gradient */}
        <LinearGradient
          colors={['#0BDA50', '#059669']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Ionicons name="leaf" size={48} color="#fff" />
          <Text style={styles.headerTitle}>Giám sát sức khỏe cây trồng</Text>
          <Text style={styles.headerSubtitle}>Phát hiện bệnh tật bằng trí tuệ nhân tạo</Text>
        </LinearGradient>

        <View style={styles.body}>
          {/* Upload Section */}
          <View style={styles.card}>
            <Ionicons name="cloud-upload-outline" size={64} color={colors.primary} />
            <Text style={styles.cardTitle}>Tải lên ảnh cây trồng để phân tích bệnh tật</Text>
            <Text style={styles.cardDesc}>Chụp ảnh rõ nét lá, thân hoặc trái cây để được kết quả chính xác</Text>
            
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => pickImage(false)}>
                <Ionicons name="images-outline" size={20} color={colors.primary} />
                <Text style={styles.outlineBtnText}>Chọn ảnh</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.primaryBtn} onPress={() => pickImage(true)}>
                <Ionicons name="camera-outline" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Chụp ảnh</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Image Preview & Analyze */}
          {image && !result && (
            <View style={styles.card}>
              <Image source={{ uri: image }} style={styles.previewImage} />
              
              {isAnalyzing ? (
                <View style={styles.analyzingContainer}>
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="sync-circle-outline" size={64} color={colors.primary} />
                  </Animated.View>
                  <Text style={styles.analyzingText}>Đang phân tích bệnh tật...</Text>
                  <Text style={styles.analyzingDesc}>Chờ chút, hệ thống sẽ trả về kết quả chính xác nhất</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <TouchableOpacity style={[styles.outlineBtn, { borderColor: '#EF4444', backgroundColor: '#FEF2F2' }]} onPress={() => setImage(null)}>
                    <Ionicons name="close" size={20} color="#EF4444" />
                    <Text style={[styles.outlineBtnText, { color: '#EF4444' }]}>Hủy</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={[styles.primaryBtn, { flex: 2 }]} onPress={analyzeImage}>
                    <Ionicons name="analytics-outline" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>Phân tích ngay</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Result Section */}
          {result && (
            <View style={styles.resultContainer}>
              <View style={[styles.resultHeaderCard, { borderColor: getSeverityColor(result.severity) }]}>
                <View style={[styles.resultHeaderCardBg, { backgroundColor: getSeverityColor(result.severity) + '1A' }]} />
                <View style={styles.resultTitleRow}>
                  <View style={[styles.iconBox, { backgroundColor: getSeverityColor(result.severity) + '33' }]}>
                    <Ionicons name="warning-outline" size={32} color={getSeverityColor(result.severity)} />
                  </View>
                  <View style={styles.resultTitleCol}>
                    <Text style={styles.resultLabel}>Bệnh tật phát hiện</Text>
                    <Text style={styles.resultName}>{result.className}</Text>
                  </View>
                </View>

                <View style={styles.resultMetricsRow}>
                  <View style={[styles.metricBox, { borderColor: colors.primary + '4D' }]}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    <Text style={[styles.metricValue, { color: colors.primary }]}>{Math.round(result.confidence * 100)}%</Text>
                    <Text style={styles.metricLabel}>Độ chính xác</Text>
                  </View>
                  <View style={[styles.metricBox, { borderColor: getSeverityColor(result.severity) + '4D' }]}>
                    <Ionicons name="podium" size={24} color={getSeverityColor(result.severity)} />
                    <Text style={[styles.metricValue, { color: getSeverityColor(result.severity) }]}>{result.severity}</Text>
                    <Text style={styles.metricLabel}>Mức độ</Text>
                  </View>
                </View>
              </View>

              <InfoCard title="Mô tả" content={result.description} icon="information-circle-outline" />
              <ListCard title="Triệu chứng" items={result.symptoms} icon="bandage-outline" />
              <ListCard title="Cách điều trị" items={result.treatment} icon="medkit-outline" />
              <ListCard title="Cách phòng ngừa" items={result.prevention} icon="shield-checkmark-outline" />

              <TouchableOpacity style={styles.refreshBtn} onPress={() => { setImage(null); setResult(null); }}>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.refreshBtnText}>Phân tích ảnh khác</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------- Sub Components ----------------

const InfoCard = ({ title, content, icon }: any) => (
  <View style={styles.infoCard}>
    <View style={styles.infoTitleRow}>
      <Ionicons name={icon} size={24} color={colors.primary} />
      <Text style={styles.infoTitle}>{title}</Text>
    </View>
    <Text style={styles.infoContent}>{content}</Text>
  </View>
);

const ListCard = ({ title, items, icon }: any) => (
  <View style={styles.infoCard}>
    <View style={styles.infoTitleRow}>
      <Ionicons name={icon} size={24} color={colors.primary} />
      <Text style={styles.infoTitle}>{title}</Text>
    </View>
    {items?.map((item: string, idx: number) => (
      <View key={idx} style={styles.listItem}>
        <Text style={styles.listDot}>•</Text>
        <Text style={styles.listText}>{item}</Text>
      </View>
    ))}
  </View>
);

// ---------------- Styles ----------------

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8F6' },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  header: { padding: 32, paddingBottom: 48, alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 26, color: '#fff', textAlign: 'center', marginTop: 16, marginBottom: 8 },
  headerSubtitle: { fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.9)', textAlign: 'center' },
  
  body: { paddingHorizontal: 24, marginTop: -24 },
  
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 4, marginBottom: 24 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.textLight, textAlign: 'center', marginTop: 24, marginBottom: 8 },
  cardDesc: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMutedLight, textAlign: 'center', marginBottom: 24 },
  
  btnRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  outlineBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: '#F0F5F1', borderRadius: 12, borderWidth: 2, borderColor: colors.primary, marginRight: 8 },
  outlineBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary, marginLeft: 8 },
  primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: colors.primary, borderRadius: 12, marginLeft: 8 },
  primaryBtnText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff', marginLeft: 8 },

  previewImage: { width: '100%', height: 300, borderRadius: 12, marginBottom: 20 },
  
  analyzingContainer: { alignItems: 'center', paddingVertical: 20 },
  analyzingText: { fontFamily: fonts.bold, fontSize: 20, color: colors.textLight, marginTop: 16, marginBottom: 8 },
  analyzingDesc: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMutedLight, textAlign: 'center' },

  resultContainer: { width: '100%' },
  resultHeaderCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, borderWidth: 2, overflow: 'hidden', marginBottom: 24 },
  resultHeaderCardBg: { ...StyleSheet.absoluteFillObject },
  resultTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconBox: { padding: 12, borderRadius: 12, marginRight: 16 },
  resultTitleCol: { flex: 1 },
  resultLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMutedLight, marginBottom: 4 },
  resultName: { fontFamily: fonts.bold, fontSize: 24, color: colors.textLight },
  
  resultMetricsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metricBox: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, marginHorizontal: 6 },
  metricValue: { fontFamily: fonts.bold, fontSize: 20, marginTop: 8, marginBottom: 4 },
  metricLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMutedLight },

  infoCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 4 },
  infoTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  infoTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.textLight, marginLeft: 8 },
  infoContent: { fontFamily: fonts.regular, fontSize: 14, color: '#4B5563', lineHeight: 22 },
  
  listItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  listDot: { fontFamily: fonts.bold, fontSize: 16, color: '#4B5563', marginRight: 8 },
  listText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: '#4B5563', lineHeight: 22 },

  refreshBtn: { flexDirection: 'row', backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  refreshBtnText: { fontFamily: fonts.bold, fontSize: 16, color: '#fff', marginLeft: 8 },
});
