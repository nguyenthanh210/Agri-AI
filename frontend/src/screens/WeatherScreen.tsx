import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { colors, fonts } from '../theme';
import apiClient from '../api/client';
import { useAuthStore } from '../store/useAuthStore';

interface WeatherData {
  temperature: number;
  humidity: number;
  condition: string;
}

export default function WeatherScreen() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const token = useAuthStore(state => state.token);

  useEffect(() => {
    fetchWeather();
  }, []);

  const fetchWeather = async () => {
    try {
      // In a real app we would send lat/lng. Using mock API call for now.
      // Replace with actual API endpoint when available:
      // const res = await apiClient.get('/weather/current', { headers: { Authorization: `Bearer ${token}` }});
      
      // Simulating API call
      setTimeout(() => {
        setWeather({
          temperature: 28,
          humidity: 65,
          condition: 'Nắng nhẹ'
        });
        setLoading(false);
      }, 1000);
      
    } catch (error) {
      console.log('Error fetching weather', error);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Thời tiết Nông trại</Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : weather ? (
          <View style={styles.weatherCard}>
            <Text style={styles.conditionIcon}>🌤</Text>
            <Text style={styles.temperature}>{weather.temperature}°C</Text>
            <Text style={styles.condition}>{weather.condition}</Text>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsText}>Độ ẩm: {weather.humidity}%</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.errorText}>Không thể tải dữ liệu thời tiết</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  header: {
    padding: 16,
    backgroundColor: colors.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.primary,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weatherCard: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  conditionIcon: {
    fontSize: 80,
    marginBottom: 16,
  },
  temperature: {
    fontFamily: fonts.bold,
    fontSize: 48,
    color: colors.textLight,
  },
  condition: {
    fontFamily: fonts.medium,
    fontSize: 24,
    color: colors.textMutedLight,
    marginBottom: 24,
  },
  detailsRow: {
    flexDirection: 'row',
  },
  detailsText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textLight,
  },
  errorText: {
    fontFamily: fonts.medium,
    color: colors.error,
  }
});
