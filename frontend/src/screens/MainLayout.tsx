import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from './Dashboard';
import FarmMapScreen from './FarmMapScreen';
import DiseaseScanScreen from './DiseaseScanScreen';
import MarketScreen from './MarketScreen';
import MenuScreen from './MenuScreen';
import { colors, fonts } from '../theme';

import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function MainLayout() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMutedLight,
        tabBarStyle: {
          backgroundColor: colors.surfaceLight,
          borderTopColor: colors.borderLight,
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 12,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;

          if (route.name === 'DashboardTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'MapTab') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'ScanTab') {
            iconName = focused ? 'scan-circle' : 'scan-circle-outline';
            size = 28; // Make scan icon slightly larger
          } else if (route.name === 'MarketTab') {
            iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          } else if (route.name === 'MenuTab') {
            iconName = focused ? 'menu' : 'menu-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="DashboardTab" 
        component={DashboardScreen} 
        options={{ tabBarLabel: 'Tổng quan' }} 
      />
      <Tab.Screen 
        name="MapTab" 
        component={FarmMapScreen} 
        options={{ tabBarLabel: 'Bản đồ' }} 
      />
      <Tab.Screen 
        name="ScanTab" 
        component={DiseaseScanScreen} 
        options={{ tabBarLabel: 'Quét bệnh' }} 
      />
      <Tab.Screen 
        name="MarketTab" 
        component={MarketScreen} 
        options={{ tabBarLabel: 'Thị trường' }} 
      />
      <Tab.Screen 
        name="MenuTab" 
        component={MenuScreen} 
        options={{ tabBarLabel: 'Menu' }} 
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
  },
  text: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.textMutedLight,
  },
});
