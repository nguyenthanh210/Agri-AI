import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts } from '../theme';
import apiClient from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const setAuth = useAuthStore(state => state.setAuth);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: '835180122402-g4b85fjm2u5jn4pn26gg976am82kc3c3.apps.googleusercontent.com',
    iosClientId: '835180122402-7bc6kie11ctchv0s05pfompi1d585h9p.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const idToken = response.authentication?.idToken || id_token;
      
      if (idToken) {
        verifyGoogleToken(idToken);
      } else {
        Alert.alert('Lỗi', 'Không nhận được ID Token từ Google');
      }
    } else if (response?.type === 'error') {
      Alert.alert('Lỗi', response.error?.message || 'Có lỗi xảy ra khi xác thực Google');
    }
  }, [response]);

  const verifyGoogleToken = async (idToken: string) => {
    setIsGoogleLoading(true);
    try {
      const loginRes = await apiClient.post('/users/google-login', { id_token: idToken });
      const token = loginRes.data.access_token;
      
      const userRes = await apiClient.get('/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setAuth(userRes.data, token);
      navigation.replace('Main');
    } catch (error: any) {
      console.log('Google login error:', error?.response?.data || error);
      Alert.alert('Lỗi đăng nhập Google', error.response?.data?.detail || 'Xác thực với server thất bại');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }
    
    setIsLoading(true);
    try {
      const payload = `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;

      const loginRes = await apiClient.post('/users/login', payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const token = loginRes.data.access_token;
      
      const userRes = await apiClient.get('/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setAuth(userRes.data, token);
      navigation.replace('Main');
    } catch (error: any) {
      let msg = error.response?.data?.detail || 'Đăng nhập thất bại. Vui lòng thử lại!';
      if (Array.isArray(msg)) {
        msg = msg.map((err: any) => err.msg || JSON.stringify(err)).join('\n');
      }
      Alert.alert('Lỗi đăng nhập', typeof msg === 'string' ? msg : 'Lỗi không xác định');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    if (!request) {
      Alert.alert('Lỗi', 'Chưa sẵn sàng đăng nhập Google. Vui lòng thử lại sau.');
      return;
    }
    promptAsync();
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>Chào mừng trở lại</Text>
          <Text style={styles.welcomeSub}>Đăng nhập vào tài khoản của bạn</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Nhập email của bạn"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Mật khẩu</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Nhập mật khẩu của bạn"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!isPasswordVisible}
            />
            <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={styles.eyeButton}>
              <Text style={{ color: colors.textMutedLight }}>{isPasswordVisible ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.loginButtonText}>Đăng nhập</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>hoặc</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin} disabled={isGoogleLoading}>
            {isGoogleLoading ? (
              <ActivityIndicator color={colors.textLight} />
            ) : (
              <Text style={styles.googleButtonText}>Đăng nhập với Google</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Chưa có tài khoản? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup' as any)}>
              <Text style={styles.signupLink}>Đăng ký ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 100,
    height: 100,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeTitle: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.textLight,
  },
  welcomeSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMutedLight,
    marginTop: 8,
  },
  formContainer: {
    flex: 1,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textLight,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textLight,
  },
  eyeButton: {
    padding: 14,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.primary,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  loginButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  dividerText: {
    marginHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMutedLight,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 24,
  },
  googleButtonText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textLight,
    marginLeft: 12,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMutedLight,
  },
  signupLink: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.primary,
  },
});
