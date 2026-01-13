import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { useAuth } from '@/src/context/auth-context';
import { apiFetch } from '@/src/lib/api';

const logo = require('../../assets/logo.jpeg');

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const response = await apiFetch('/api/associado/login', {
        method: 'POST',
        body: JSON.stringify({ email, cpf })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.token) {
        throw new Error(data?.error || 'Falha ao entrar');
      }
      await login(String(data.token));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel acessar';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.cardAccent} />
            <View style={styles.logoRow}>
              <View style={styles.logoWrap}>
                <Image source={logo} style={styles.logo} />
              </View>
              <View>
                <Text style={styles.eyebrow}>Associacao</Text>
                <Text style={styles.title}>Jardim Tarraf II</Text>
              </View>
            </View>

            <Text style={styles.portalTag}>Acesso do associado</Text>
            <Text style={styles.heading}>Portal da Associacao</Text>
            <Text style={styles.subheading}>Acesse com seu email e CPF.</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="seuemail@exemplo.com"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>CPF</Text>
              <TextInput
                style={styles.input}
                value={cpf}
                onChangeText={setCpf}
                placeholder="000.000.000-00"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.helper}>
              Precisa de ajuda? Chame no grupo de WhatsApp da associacao.
            </Text>

            <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  flex: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#3b82f6'
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  logoWrap: {
    borderRadius: 28,
    padding: 4,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#dbeafe'
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24
  },
  eyebrow: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#3b82f6',
    fontWeight: '600'
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a'
  },
  portalTag: {
    marginTop: 18,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#94a3b8',
    fontWeight: '600'
  },
  heading: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a'
  },
  subheading: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748b'
  },
  field: {
    marginTop: 16
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: '#f8fafc'
  },
  helper: {
    marginTop: 12,
    fontSize: 12,
    color: '#64748b'
  },
  error: {
    marginTop: 12,
    fontSize: 12,
    color: '#dc2626'
  },
  button: {
    marginTop: 16,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center'
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  }
});
