import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { apiFetch } from '@/src/lib/api';
import { formatCurrencyNoCents, formatDateDisplayDashShort } from '@/src/utils/format';

const logo = require('../../assets/logo.jpeg');
const qrCode = require('../../assets/qr-code.png');

const MONTHLY_FEE = 30;
const PIX_CNPJ = '05152486000105';

type Profile = {
  nome?: string;
  cpf?: string;
  email?: string;
  rua?: string;
  numero?: string;
  telefone?: string;
  profissao?: string;
};

type Payment = {
  idmensalidade: number | string;
  competencia?: string;
  doacao?: number | string;
  valor_total?: number | string;
  data_pagamento?: string;
};

type PollOption = {
  idopcao: number;
  texto: string;
  votos: number;
};

type Poll = {
  idenquete: number;
  titulo: string;
  descricao?: string;
  status?: string;
  opcoes: PollOption[];
  voto_idopcao?: number | null;
};

type Props = {
  token: string;
  onLogout: () => void;
};

export function UserDashboardScreen({ token, onLogout }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Profile>({
    nome: '',
    cpf: '',
    email: '',
    rua: '',
    numero: '',
    telefone: '',
    profissao: ''
  });
  const [payments, setPayments] = useState<Payment[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pollsLoading, setPollsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pollsError, setPollsError] = useState('');
  const [qrCopyStatus, setQrCopyStatus] = useState<'loading' | 'success' | 'error' | ''>('');

  useEffect(() => {
    let isActive = true;
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [profileRes, paymentsRes] = await Promise.all([
          apiFetch('/api/associado/me', {}, token),
          apiFetch('/api/associado/pagamentos?all=1', {}, token)
        ]);
        if (!profileRes.ok) throw new Error('Falha ao carregar perfil');
        if (!paymentsRes.ok) throw new Error('Falha ao carregar pagamentos');
        const profileData = await profileRes.json();
        const paymentsData = await paymentsRes.json();
        if (!isActive) return;
        setProfile(profileData || null);
        setForm({
          nome: profileData?.nome || '',
          cpf: profileData?.cpf || '',
          email: profileData?.email || '',
          rua: profileData?.rua || '',
          numero: profileData?.numero || '',
          telefone: profileData?.telefone || '',
          profissao: profileData?.profissao || ''
        });
        setPayments(Array.isArray(paymentsData) ? paymentsData : []);
      } catch (err) {
        if (isActive) setError('Nao foi possivel carregar seus dados.');
      } finally {
        if (isActive) setLoading(false);
      }
    }
    loadData();
    return () => {
      isActive = false;
    };
  }, [token]);

  useEffect(() => {
    let isActive = true;
    async function loadPolls() {
      setPollsLoading(true);
      setPollsError('');
      try {
        const response = await apiFetch('/api/associado/enquetes', {}, token);
        if (!response.ok) throw new Error('Falha ao carregar');
        const data = await response.json();
        if (isActive) setPolls(Array.isArray(data) ? data : []);
      } catch (err) {
        if (isActive) setPollsError('Nao foi possivel carregar as enquetes.');
      } finally {
        if (isActive) setPollsLoading(false);
      }
    }
    loadPolls();
    return () => {
      isActive = false;
    };
  }, [token]);

  async function handleVote(idenquete: number, idopcao: number) {
    setPollsError('');
    try {
      const response = await apiFetch(
        `/api/associado/enquetes/${idenquete}/votar`,
        {
          method: 'POST',
          body: JSON.stringify({ idopcao })
        },
        token
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Falha ao votar');
      }
      const data = await response.json();
      setPolls(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel registrar seu voto.';
      setPollsError(message);
    }
  }

  async function handleCopyQrCode() {
    if (qrCopyStatus === 'loading') return;
    setQrCopyStatus('loading');
    try {
      await Clipboard.setStringAsync(PIX_CNPJ);
      setQrCopyStatus('success');
    } catch (err) {
      setQrCopyStatus('error');
    } finally {
      setTimeout(() => setQrCopyStatus(''), 4000);
    }
  }

  async function handleSaveProfile() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const response = await apiFetch(
        '/api/associado/me',
        {
          method: 'PUT',
          body: JSON.stringify({
            nome: form.nome,
            rua: form.rua,
            numero: form.numero,
            telefone: form.telefone,
            profissao: form.profissao
          })
        },
        token
      );
      if (!response.ok) throw new Error('Falha ao salvar');
      setMessage('Dados atualizados com sucesso.');
    } catch (err) {
      setError('Nao foi possivel salvar seus dados.');
    } finally {
      setSaving(false);
    }
  }

  function updateField(key: keyof Profile, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const sortedPayments = useMemo(() => {
    return [...payments].sort((a, b) =>
      String(b.competencia || '').localeCompare(String(a.competencia || ''))
    );
  }, [payments]);

  const totalPago = sortedPayments.reduce((sum, item) => sum + Number(item.valor_total || 0), 0);
  const { totalPago12m, totalDoacao12m } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setMonth(cutoff.getMonth() - 12);
    return payments.reduce(
      (acc, item) => {
        const competenciaDate = item.competencia ? new Date(item.competencia) : null;
        if (!competenciaDate || Number.isNaN(competenciaDate.getTime())) return acc;
        if (competenciaDate >= cutoff) {
          acc.totalPago12m += Number(item.valor_total || 0);
          acc.totalDoacao12m += Number(item.doacao || 0);
        }
        return acc;
      },
      { totalPago12m: 0, totalDoacao12m: 0 }
    );
  }, [payments]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.logoWrap}>
              <Image source={logo} style={styles.logo} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerEyebrow}>Area do Associado</Text>
              <Text style={styles.headerTitle}>Jardim Tarraf II</Text>
              <Text style={styles.headerSubtitle}>Gestao 2026-2027</Text>
            </View>
          </View>
          <Pressable style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutText}>Sair</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.screenError}>{error}</Text> : null}
        {message ? <Text style={styles.screenSuccess}>{message}</Text> : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Seus dados</Text>
            <Text style={styles.badge}>{loading ? 'Carregando...' : profile?.nome || 'Associado'}</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Atualize seus dados de contato.</Text>

          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                style={styles.input}
                value={form.nome}
                onChangeText={(text) => updateField('nome', text)}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>CPF</Text>
              <TextInput style={[styles.input, styles.inputDisabled]} value={form.cpf} editable={false} />
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput style={[styles.input, styles.inputDisabled]} value={form.email} editable={false} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Telefone</Text>
              <TextInput
                style={styles.input}
                value={form.telefone}
                onChangeText={(text) => updateField('telefone', text)}
              />
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.label}>Rua</Text>
              <TextInput
                style={styles.input}
                value={form.rua}
                onChangeText={(text) => updateField('rua', text)}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Numero</Text>
              <TextInput
                style={styles.input}
                value={form.numero}
                onChangeText={(text) => updateField('numero', text)}
              />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Profissao</Text>
            <TextInput
              style={styles.input}
              value={form.profissao}
              onChangeText={(text) => updateField('profissao', text)}
            />
          </View>

          <Text style={styles.helper}>
            Para alterar CPF ou email, entre em contato pelo email tarraf2@gmail.com ou pelo grupo da associacao.
          </Text>

          <Pressable style={styles.button} onPress={handleSaveProfile} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Salvar alteracoes</Text>}
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Enquetes</Text>
            <Text style={styles.badge}>{polls.length} enquete(s)</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Participe das enquetes da associacao.</Text>
          {pollsError ? <Text style={styles.sectionError}>{pollsError}</Text> : null}
          {pollsLoading ? (
            <ActivityIndicator style={styles.loading} />
          ) : polls.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma enquete ativa.</Text>
          ) : (
            polls.map((poll) => (
              <View key={poll.idenquete} style={styles.pollCard}>
                <View style={styles.pollHeader}>
                  <View style={styles.pollHeaderText}>
                    <Text style={styles.pollTitle}>{poll.titulo}</Text>
                    {poll.descricao ? <Text style={styles.pollDescription}>{poll.descricao}</Text> : null}
                  </View>
                  <Text style={poll.status === 'aberta' ? styles.tagOpen : styles.tagClosed}>
                    {poll.status === 'aberta' ? 'Aberta' : 'Encerrada'}
                  </Text>
                </View>
                <View style={styles.pollOptions}>
                  {poll.opcoes.map((option) => {
                    const isSelected = poll.voto_idopcao === option.idopcao;
                    const disabled = Boolean(poll.voto_idopcao);
                    return (
                      <Pressable
                        key={option.idopcao}
                        style={[
                          styles.pollOption,
                          isSelected ? styles.pollOptionSelected : null,
                          disabled ? styles.pollOptionDisabled : null
                        ]}
                        onPress={() => (disabled ? null : handleVote(poll.idenquete, option.idopcao))}
                      >
                        <Text style={styles.pollOptionText}>{option.texto}</Text>
                        {poll.voto_idopcao ? (
                          <Text style={styles.pollOptionVotes}>{option.votos} votos</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
                {poll.voto_idopcao ? (
                  <Text style={styles.helper}>Obrigado pelo voto! Confira o resultado acima.</Text>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QR Code para pagamento</Text>
          <Text style={styles.sectionSubtitle}>Copie a chave CNPJ ou escaneie o QR code.</Text>
          <View style={styles.qrActions}>
            <Pressable style={styles.buttonSmall} onPress={handleCopyQrCode} disabled={qrCopyStatus === 'loading'}>
              <Text style={styles.buttonTextSmall}>
                {qrCopyStatus === 'loading' ? 'Copiando...' : 'Copiar chave CNPJ'}
              </Text>
            </Pressable>
            {qrCopyStatus === 'success' ? (
              <Text style={styles.sectionSuccess}>CNPJ copiado.</Text>
            ) : qrCopyStatus === 'error' ? (
              <Text style={styles.sectionError}>Nao foi possivel copiar.</Text>
            ) : null}
          </View>
          <View style={styles.qrBox}>
            <Image source={qrCode} style={styles.qrImage} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pagamentos</Text>
            <Text style={styles.badge}>{payments.length} registros</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Total pago: {formatCurrencyNoCents(totalPago)}</Text>
          {totalPago12m >= 360 && totalDoacao12m > 0 ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Prezado Associado, obrigado por suas doacoes, voce nao tem debitos com a associacao.
              </Text>
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator style={styles.loading} />
          ) : payments.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum pagamento registrado.</Text>
          ) : (
            sortedPayments.map((item) => (
              <View key={item.idmensalidade} style={styles.paymentCard}>
                <View style={styles.paymentHeader}>
                  <Text style={styles.paymentLabel}>Competencia</Text>
                  <Text style={styles.paymentValue}>{formatDateDisplayDashShort(item.competencia)}</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Pagamento</Text>
                  <Text style={styles.paymentValue}>{formatCurrencyNoCents(MONTHLY_FEE)}</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Doacao</Text>
                  <Text style={styles.paymentValue}>{formatCurrencyNoCents(item.doacao)}</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Total</Text>
                  <Text style={styles.paymentTotal}>{formatCurrencyNoCents(item.valor_total)}</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Data pagamento</Text>
                  <Text style={styles.paymentValue}>{formatDateDisplayDashShort(item.data_pagamento)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  scrollContent: {
    paddingBottom: 32
  },
  header: {
    backgroundColor: '#2563eb',
    padding: 20,
    overflow: 'hidden'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  logoWrap: {
    padding: 3,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)'
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24
  },
  headerText: {
    flex: 1
  },
  headerEyebrow: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#dbeafe'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff'
  },
  headerSubtitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: '#bfdbfe',
    marginTop: 4
  },
  logoutButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '600'
  },
  section: {
    marginTop: 20,
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  sectionSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748b'
  },
  badge: {
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '600'
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12
  },
  field: {
    flex: 1,
    marginTop: 12
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569'
  },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    backgroundColor: '#f8fafc'
  },
  inputDisabled: {
    color: '#94a3b8',
    backgroundColor: '#f1f5f9'
  },
  helper: {
    marginTop: 10,
    fontSize: 12,
    color: '#64748b'
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
    fontWeight: '700',
    fontSize: 13
  },
  buttonSmall: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center'
  },
  buttonTextSmall: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12
  },
  screenError: {
    marginTop: 12,
    fontSize: 12,
    color: '#dc2626',
    marginHorizontal: 20
  },
  screenSuccess: {
    marginTop: 12,
    fontSize: 12,
    color: '#16a34a',
    marginHorizontal: 20
  },
  sectionError: {
    marginTop: 12,
    fontSize: 12,
    color: '#dc2626'
  },
  sectionSuccess: {
    marginTop: 8,
    fontSize: 12,
    color: '#16a34a'
  },
  loading: {
    marginTop: 12
  },
  emptyText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 13
  },
  pollCard: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc'
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8
  },
  pollHeaderText: {
    flex: 1
  },
  pollTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  pollDescription: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b'
  },
  tagOpen: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10
  },
  tagClosed: {
    alignSelf: 'flex-start',
    backgroundColor: '#e2e8f0',
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10
  },
  pollOptions: {
    marginTop: 10,
    gap: 8
  },
  pollOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff'
  },
  pollOptionSelected: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff'
  },
  pollOptionDisabled: {
    backgroundColor: '#f1f5f9'
  },
  pollOptionText: {
    fontSize: 13,
    color: '#0f172a'
  },
  pollOptionVotes: {
    marginTop: 4,
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600'
  },
  qrActions: {
    marginTop: 12,
    gap: 8
  },
  qrBox: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    padding: 12
  },
  qrImage: {
    width: 200,
    height: 200,
    resizeMode: 'contain'
  },
  notice: {
    marginTop: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  noticeText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '600'
  },
  paymentCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc'
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4
  },
  paymentLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: '#94a3b8'
  },
  paymentValue: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600'
  },
  paymentTotal: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700'
  }
});
