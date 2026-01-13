import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/src/context/auth-context';
import { UserDashboardScreen } from '@/src/screens/user-dashboard';

export default function Dashboard() {
  const { token, loading, logout } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return <Redirect href="/" />;
  }

  return <UserDashboardScreen token={token} onLogout={logout} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
