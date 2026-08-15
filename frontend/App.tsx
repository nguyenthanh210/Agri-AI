import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  useFonts,
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
  BeVietnamPro_900Black,
} from '@expo-google-fonts/be-vietnam-pro';
import { ActivityIndicator, View } from 'react-native';
import SplashScreen from './src/screens/Splash';
import LoginScreen from './src/screens/Login';
import SignupScreen from './src/screens/SignupScreen';
import MainLayout from './src/screens/MainLayout';

import AiChatScreen from './src/screens/AiChatScreen';
import WeatherScreen from './src/screens/WeatherScreen';
import SatelliteMonitoringScreen from './src/screens/SatelliteMonitoringScreen';
import AdminPanelScreen from './src/screens/AdminPanelScreen';
import FarmingLogScreen from './src/screens/FarmingLogScreen';
import TraceabilityScreen from './src/screens/TraceabilityScreen';
import SmartIrrigationScreen from './src/screens/SmartIrrigationScreen';
import YieldFinanceScreen from './src/screens/YieldFinanceScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
    BeVietnamPro_900Black,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0BDA50" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Main" component={MainLayout} />
        <Stack.Screen name="AiChat" component={AiChatScreen} />
        <Stack.Screen name="Weather" component={WeatherScreen} />
        <Stack.Screen name="Satellite" component={SatelliteMonitoringScreen} />
        <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />
        <Stack.Screen name="FarmingLog" component={FarmingLogScreen} />
        <Stack.Screen name="Traceability" component={TraceabilityScreen} />
        <Stack.Screen name="SmartIrrigation" component={SmartIrrigationScreen} />
        <Stack.Screen name="YieldFinance" component={YieldFinanceScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

