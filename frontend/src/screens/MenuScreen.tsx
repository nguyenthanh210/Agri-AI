import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { colors, fonts } from '../theme';
import apiClient from '../api/client';

export default function MenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const logout = useAuthStore(state => state.logout);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.full_name || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn chắc chắn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => {
          logout();
          navigation.replace('Login');
        }
      }
    ]);
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      await apiClient.put('/users/me', { full_name: editName }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert('Thành công', 'Đã cập nhật thông tin cá nhân!');
      setIsEditModalVisible(false);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể cập nhật thông tin lúc này');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ thông tin');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.post('/users/change-password', {
        old_password: oldPassword,
        new_password: newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert('Thành công', 'Đã đổi mật khẩu thành công!');
      setIsPasswordModalVisible(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Không thể đổi mật khẩu lúc này';
      Alert.alert('Lỗi', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map((w: string) => w[0]).slice(-2).join('').toUpperCase()
    : 'U';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Tài khoản</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <TouchableOpacity style={styles.editAvatarBtn} onPress={() => setIsEditModalVisible(true)}>
              <Ionicons name="pencil" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{user?.full_name || 'Người dùng'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
          {user?.is_superuser && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={12} color={colors.primary} />
              <Text style={styles.adminBadgeText}>Quản trị viên</Text>
            </View>
          )}
        </View>

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tài khoản</Text>

          <MenuItem
            icon="person-outline"
            label="Chỉnh sửa thông tin"
            onPress={() => {
              setEditName(user?.full_name || '');
              setIsEditModalVisible(true);
            }}
          />
          <MenuItem
            icon="lock-closed-outline"
            label="Đổi mật khẩu"
            onPress={() => setIsPasswordModalVisible(true)}
          />
          {user?.is_superuser && (
            <MenuItem
              icon="settings-outline"
              label="Quản trị hệ thống"
              onPress={() => navigation.navigate('AdminPanel')}
              color={colors.primary}
            />
          )}
        </View>

        {/* App Features */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tính năng</Text>
          <MenuItem icon="partly-sunny-outline" label="Thời tiết khu vực" onPress={() => navigation.navigate('Weather')} />
          <MenuItem icon="planet-outline" label="Giám sát vệ tinh" onPress={() => navigation.navigate('Satellite')} />
          <MenuItem icon="water-outline" label="Tưới tiêu thông minh" onPress={() => navigation.navigate('SmartIrrigation')} />
          <MenuItem icon="chatbubble-ellipses-outline" label="Trợ lý AI" onPress={() => navigation.navigate('AiChat')} />
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Hỗ trợ</Text>
          <MenuItem icon="notifications-outline" label="Cài đặt thông báo" />
          <MenuItem icon="help-circle-outline" label="Trợ giúp & Hỗ trợ" />
          <MenuItem icon="information-circle-outline" label="Về ứng dụng" />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutButtonText}>Đăng xuất</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={isEditModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Chỉnh sửa thông tin</Text>
            <Text style={styles.inputLabel}>Họ và tên</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Nhập họ và tên"
              placeholderTextColor={colors.textMutedLight}
            />
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={user?.email || ''}
              editable={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsEditModalVisible(false)}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleUpdateProfile} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalSaveText}>Lưu thay đổi</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={isPasswordModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Đổi mật khẩu</Text>
            <Text style={styles.inputLabel}>Mật khẩu hiện tại</Text>
            <TextInput style={styles.input} value={oldPassword} onChangeText={setOldPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.textMutedLight} />
            <Text style={styles.inputLabel}>Mật khẩu mới</Text>
            <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.textMutedLight} />
            <Text style={styles.inputLabel}>Xác nhận mật khẩu mới</Text>
            <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.textMutedLight} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsPasswordModalVisible(false)}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleChangePassword} disabled={isSaving}>
                {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalSaveText}>Đổi mật khẩu</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const MenuItem = ({ icon, label, onPress, color }: { icon: any; label: string; onPress?: () => void; color?: string }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} disabled={!onPress}>
    <View style={[styles.menuIconBox, { backgroundColor: (color || colors.textMutedLight) + '15' }]}>
      <Ionicons name={icon} size={20} color={color || colors.textMutedLight} />
    </View>
    <Text style={[styles.menuItemText, color ? { color } : {}]}>{label}</Text>
    {onPress && <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8F6' },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontFamily: fonts.bold, fontSize: 28, color: colors.textLight },

  profileCard: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  avatarWrapper: { position: 'relative', marginBottom: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 32, color: '#fff' },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  name: { fontFamily: fonts.bold, fontSize: 22, color: colors.textLight },
  email: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMutedLight, marginTop: 4 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 10 },
  adminBadgeText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.primary, marginLeft: 4 },

  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textMutedLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, marginBottom: 8 },
  menuIconBox: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuItemText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.textLight },

  logoutButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginHorizontal: 16, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', padding: 16, borderRadius: 14 },
  logoutButtonText: { fontFamily: fonts.bold, fontSize: 16, color: '#EF4444', marginLeft: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 48 },
  modalTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.textLight, marginBottom: 20 },
  inputLabel: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textMutedLight, marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontFamily: fonts.medium, fontSize: 15, marginBottom: 14, color: colors.textLight },
  disabledInput: { color: colors.textMutedLight, backgroundColor: '#F3F4F6' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  modalCancelBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  modalCancelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textMutedLight },
  modalSaveBtn: { backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, minWidth: 120, alignItems: 'center' },
  modalSaveText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },
});
