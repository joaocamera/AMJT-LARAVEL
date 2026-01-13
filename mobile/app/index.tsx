import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/src/context/auth-context';
import { LoginScreen } from '@/src/screens/login-screen';

export default function Index() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (token) {
    return <Redirect href="/dashboard" />;
  }

  return <LoginScreen />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
