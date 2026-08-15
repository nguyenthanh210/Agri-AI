import axios from 'axios';
import { Platform } from 'react-native';

// Lấy IP của máy chủ tuỳ theo môi trường chạy app
// Trên Web: localhost
// Trên Android Emulator: 10.0.2.2
// Trên iOS Simulator: localhost hoặc 127.0.0.1
const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Thay đổi thành IP mạng LAN (hoặc IP công cộng) để test trên điện thoại vật lý
  if (Platform.OS === 'android') {
    return 'http://192.168.100.107:8000/api/v1'; // 10.0.2.2 only works on emulator
  }
  return 'http://192.168.100.107:8000/api/v1'; // Localhost only works on Simulator/Web
};

const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true', // Needed to bypass LocalTunnel warning screen
  },
});

export default apiClient;
