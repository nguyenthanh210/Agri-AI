import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
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
  Signup: undefined;
};

export default function SignupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const setAuth = useAuthStore(state => state.setAuth);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: '835180122402-g4b85fjm2u5jn4pn26gg976am82kc3c3.apps.googleusercontent.com',
    iosClientId: '835180122402-7bc6kie11ctchv0s05pfompi1d585h9p.apps.googleusercontent.com',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  });

  React.useEffect(() => {
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
      navigation.replace('Main' as any);
    } catch (error: any) {
      console.log('Google login error:', error?.response?.data || error);
      Alert.alert('Lỗi đăng nhập Google', error.response?.data?.detail || 'Xác thực với server thất bại');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    if (!request) {
      Alert.alert('Lỗi', 'Chưa sẵn sàng đăng nhập Google. Vui lòng thử lại sau.');
      return;
    }
    promptAsync();
  };

  const handleSignup = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
      return;
    }
    
    if (password !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp');
      return;
    }
    
    setIsLoading(true);
    try {
      // The API endpoint for registration in FastAPI is typically /users/register
      await apiClient.post('/users/register', {
        email,
        username: email, // Backend CreateUserDTO requires username
        password,
        full_name: fullName
      });
      
      Alert.alert('Thành công', 'Đăng ký tài khoản thành công! Vui lòng đăng nhập.', [
        { text: 'OK', onPress: () => navigation.replace('Login') }
      ]);
    } catch (error: any) {
      let msg = error.response?.data?.detail || 'Đăng ký thất bại. Email có thể đã tồn tại.';
      if (Array.isArray(msg)) {
        msg = msg.map((err: any) => err.msg || JSON.stringify(err)).join('\n');
      }
      Alert.alert('Lỗi đăng ký', typeof msg === 'string' ? msg : 'Lỗi không xác định');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Tạo tài khoản mới</Text>
          <Text style={styles.subtitle}>Điền thông tin để tham gia cùng chúng tôi</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>Họ và tên</Text>
          <TextInput
            style={styles.input}
            placeholder="Nhập họ và tên"
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Nhập địa chỉ email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Mật khẩu</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Nhập mật khẩu"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!isPasswordVisible}
            />
            <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={styles.eyeButton}>
              <Text style={{ color: colors.textMutedLight }}>{isPasswordVisible ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>Xác nhận Mật khẩu</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Nhập lại mật khẩu"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!isConfirmPasswordVisible}
            />
            <TouchableOpacity onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)} style={styles.eyeButton}>
              <Text style={{ color: colors.textMutedLight }}>{isConfirmPasswordVisible ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.signupButton} onPress={handleSignup} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.signupButtonText}>Đăng ký</Text>
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
              <Text style={styles.googleButtonText}>Đăng ký với Google</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}>Đăng nhập</Text>
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
    paddingTop: 80,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: colors.textLight,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 16,
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
  signupButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  signupButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMutedLight,
  },
  loginLink: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.primary,
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
});
