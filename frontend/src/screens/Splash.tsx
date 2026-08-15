import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts } from '../theme';
import { useAuthStore } from '../store/useAuthStore';

// Update with correct root stack param list later
type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Main: undefined;
};

type SplashScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Splash'>;

export default function SplashScreen() {
  const navigation = useNavigation<SplashScreenNavigationProp>();
  const token = useAuthStore(state => state.token);

  useEffect(() => {
    if (token) {
      navigation.replace('Main');
    } else {
      navigation.replace('Login');
    }
  }, [navigation, token]);

  return (
    <View style={styles.container}>
      {/* Assuming icon.png is our logo for now, in a real app we'd copy OpenAgri.png */}
      <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>OmniFarm</Text>
      <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 150,
    height: 150,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.primary,
    marginTop: 16,
  },
});
