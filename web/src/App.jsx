import { useEffect, useMemo, useState } from "react";
import { LogOut, PencilLine, Search } from "lucide-react";
import logo from "./logo.jpeg";
import qrCode from "./qr-code.svg";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function apiFetch(path, options = {}, token) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

function formatCurrency(value) {
  const num = Number(value) || 0;
  return `R$ ${num.toFixed(2)}`;
}

function formatDateDisplay(value) {
  if (!value) return "";
  const datePart = String(value).split("T")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return String(value);
  const [year, month, day] = parts;
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year}`;
}

function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await apiFetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      if (!response.ok) {
        throw new Error("Credenciais invalidas");
      }
      const data = await response.json();
      onLogin(data.token);
    } catch (err) {
      setError("Usuario ou senha incorretos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="text-sm font-medium text-slate-600">Usuario</label>
        <input
          className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="admin"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-600">Senha</label>
        <input
          type="password"
          className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="1234"
        />
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <button
        type="submit"
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

function UserLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await apiFetch("/api/associado/login", {
        method: "POST",
        body: JSON.stringify({ email, cpf })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Falha ao entrar");
      }
      onLogin(data.token);
    } catch (err) {
      setError(err.message || "Nao foi possivel acessar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="text-sm font-medium text-slate-600">Email</label>
        <input
          type="email"
          className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seuemail@exemplo.com"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-600">CPF</label>
        <input
          className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          value={cpf}
          onChange={(event) => setCpf(event.target.value)}
          placeholder="000.000.000-00"
        />
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <p className="text-xs text-slate-500">
        Precisa de ajuda? Chame no grupo de WhatsApp da associação.
      </p>
      <button
        type="submit"
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

function AccessPortal({ onAdminLogin, onUserLogin }) {
  const [activeTab, setActiveTab] = useState("associado");

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-100 bg-white p-8 shadow-card">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-400" />
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-blue-100/70 blur-2xl" />
        <div className="mb-8">
          <div className="mb-5 flex items-center gap-4">
            <div className="rounded-full bg-white p-1 shadow-md ring-4 ring-blue-100">
              <img
                src={logo}
                alt="Associação de Moradores Jardim Tarraf II"
                className="h-14 w-14 rounded-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-blue-500 font-semibold">
                Associação
              </p>
              <p className="text-sm font-semibold text-slate-700">
                Jardim Tarraf II
              </p>
            </div>
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-500 font-semibold">
            Tarraf II
          </p>
          <h1 className="mt-3 text-2xl font-display text-slate-900">
            Portal da Associação
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Acesse como administrador ou associado.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Acesso do associado
          </p>
          <button
            type="button"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500 hover:text-blue-600"
            onClick={() =>
              setActiveTab((prev) => (prev === "admin" ? "associado" : "admin"))
            }
          >
            {activeTab === "admin" ? "Voltar" : "Admin"}
          </button>
        </div>

        {activeTab === "admin" ? (
          <AdminLogin onLogin={onAdminLogin} />
        ) : (
          <UserLogin onLogin={onUserLogin} />
        )}
      </div>
    </div>
  );
}

function EditModal({ open, onClose, onSave, value }) {
  const [form, setForm] = useState(value);

  useEffect(() => {
    setForm(value);
  }, [value]);

  if (!open) return null;

  function updateField(field, newValue) {
    setForm((prev) => ({ ...prev, [field]: newValue }));
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-500 font-semibold">
              Edicao
            </p>
            <h2 className="mt-2 text-xl font-display text-slate-900">
              Atualizar associado
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Nome: {value?.nome}
            </p>
          </div>
          <button
            className="text-sm text-slate-400 hover:text-slate-700"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-600">CPF</label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form?.cpf || ""}
              onChange={(event) => updateField("cpf", event.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Rua</label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form?.rua || ""}
              onChange={(event) => updateField("rua", event.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Numero</label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form?.numero || ""}
              onChange={(event) => updateField("numero", event.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Telefone</label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form?.telefone || ""}
              onChange={(event) => updateField("telefone", event.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Email</label>
            <input
              type="email"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form?.email || ""}
              onChange={(event) => updateField("email", event.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-600">Profissao</label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form?.profissao || ""}
              onChange={(event) => updateField("profissao", event.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={() => onSave(form)}
          >
            Salvar alteracoes
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDateInput(value) {
  return value.toISOString().slice(0, 10);
}

function MensalidadesModal({
  open,
  onClose,
  inscrito,
  rows,
  loading,
  error,
  form,
  onChange,
  onSave,
  onDelete
}) {
  if (!open) return null;

  const mesesInt = Number.isFinite(Number(form.meses)) ? Number(form.meses) : 1;
  const doacaoNum = Number.isFinite(Number(form.doacao)) ? Number(form.doacao) : 0;
  const total = (mesesInt * 30 + doacaoNum).toFixed(2);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-500 font-semibold">
              Mensalidades
            </p>
            <h2 className="mt-2 text-xl font-display text-slate-900">
              Controle de pagamentos
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Associado: {inscrito?.nome}
            </p>
          </div>
          <button
            className="text-sm text-slate-400 hover:text-slate-700"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700">
            Registrar pagamento
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-5">
            <div>
              <label className="text-xs font-medium text-slate-500">Competencia</label>
              <input
                type="date"
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.competencia}
                onChange={(event) => onChange("competencia", event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Meses</label>
              <input
                type="number"
                min="1"
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.meses}
                onChange={(event) => onChange("meses", event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Doação</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.doacao}
                onChange={(event) => onChange("doacao", event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Pagamento</label>
              <input
                type="date"
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.data_pagamento}
                onChange={(event) => onChange("data_pagamento", event.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Total</label>
              <div className="mt-2 flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                R$ {total}
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Valor mensal fixo: R$ 30,00
            </p>
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onSave}
              disabled={loading}
            >
              Registrar pagamento
            </button>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-3 pr-4">Competencia</th>
                <th className="py-3 pr-4">Meses</th>
                <th className="py-3 pr-4">Doacao</th>
                <th className="py-3 pr-4">Total</th>
                <th className="py-3 pr-4">Pagamento</th>
                <th className="py-3 pr-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && rows.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={6}>
                    Carregando...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={6}>
                    Nenhum pagamento registrado.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.idmensalidade} className="text-slate-700">
                    <td className="py-3 pr-4">{row.competencia}</td>
                    <td className="py-3 pr-4">{row.meses}</td>
                    <td className="py-3 pr-4">R$ {Number(row.doacao || 0).toFixed(2)}</td>
                    <td className="py-3 pr-4">R$ {Number(row.valor_total || 0).toFixed(2)}</td>
                    <td className="py-3 pr-4">{row.data_pagamento}</td>
                    <td className="py-3 pr-4 text-right">
                      <button
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        onClick={() => onDelete(row.idmensalidade)}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserDashboard({ token, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    email: "",
    rua: "",
    numero: "",
    telefone: "",
    profissao: ""
  });
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isActive = true;
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [profileRes, paymentsRes] = await Promise.all([
          apiFetch("/api/associado/me", {}, token),
          apiFetch("/api/associado/pagamentos", {}, token)
        ]);
        if (!profileRes.ok) {
          throw new Error("Falha ao carregar perfil");
        }
        if (!paymentsRes.ok) {
          throw new Error("Falha ao carregar pagamentos");
        }
        const profileData = await profileRes.json();
        const paymentsData = await paymentsRes.json();
        if (!isActive) return;
        setProfile(profileData);
        setForm({
          nome: profileData.nome || "",
          cpf: profileData.cpf || "",
          email: profileData.email || "",
          rua: profileData.rua || "",
          numero: profileData.numero || "",
          telefone: profileData.telefone || "",
          profissao: profileData.profissao || ""
        });
        setPayments(paymentsData || []);
      } catch (err) {
        if (isActive) {
          setError("Nao foi possivel carregar seus dados.");
        }
      } finally {
        if (isActive) setLoading(false);
      }
    }
    loadData();
    return () => {
      isActive = false;
    };
  }, [token]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveProfile() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await apiFetch(
        "/api/associado/me",
        {
          method: "PUT",
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
      if (!response.ok) {
        throw new Error("Falha ao salvar");
      }
      setMessage("Dados atualizados com sucesso.");
    } catch (err) {
      setError("Nao foi possivel salvar seus dados.");
    } finally {
      setSaving(false);
    }
  }

  const totalPago = payments.reduce((sum, item) => sum + Number(item.valor_total || 0), 0);

  return (
    <div className="min-h-screen">
      <header className="relative overflow-hidden bg-blue-600 text-white">
        <div className="pointer-events-none absolute -left-20 top-0 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
        <div className="pointer-events-none absolute -right-24 -top-10 h-44 w-44 rounded-full bg-sky-300/30 blur-2xl" />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-white/20 p-1 ring-2 ring-white/30">
              <img
                src={logo}
                alt="Associacao de Moradores Jardim Tarraf II"
                className="h-12 w-12 rounded-full bg-white object-cover"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-blue-100">
                Area do Associado
              </p>
              <h1 className="text-2xl font-display">Jardim Tarraf II</h1>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-blue-100/90">
                Gestao 2026-2027
              </p>
            </div>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25"
            onClick={onLogout}
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="mb-4 text-sm text-emerald-600">{message}</p> : null}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl bg-white p-6 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-display text-slate-900">
                  Seus dados
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Atualize seus dados de contato.
                </p>
              </div>
              <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                {loading ? "Carregando..." : profile?.nome || "Associado"}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-600">Nome</label>
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.nome}
                  onChange={(event) => updateField("nome", event.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">CPF</label>
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-400"
                  value={form.cpf}
                  disabled
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">Email</label>
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-400"
                  value={form.email}
                  disabled
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">Telefone</label>
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.telefone}
                  onChange={(event) => updateField("telefone", event.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">Rua</label>
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.rua}
                  onChange={(event) => updateField("rua", event.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">Numero</label>
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.numero}
                  onChange={(event) => updateField("numero", event.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-600">Profissao</label>
                <input
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={form.profissao}
                  onChange={(event) => updateField("profissao", event.target.value)}
                />
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Para alterar CPF ou email, entre em contato pelo email tarraf2@gmail.com
              ou pelo grupo da associacao no WhatsApp.
            </p>

            <div className="mt-6 flex justify-end">
              <button
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleSaveProfile}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar alteracoes"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-2xl bg-white p-6 shadow-card">
              <h3 className="text-lg font-display text-slate-900">
                QR Code para pagamento
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Use o QR Code abaixo para realizar pagamentos.
              </p>
              <div className="mt-4 flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                <img
                  src={qrCode}
                  alt="QR Code para pagamento"
                  className="h-48 w-48"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-display text-slate-900">
                    Pagamentos
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Total pago: {formatCurrency(totalPago)}
                  </p>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                  {payments.length} registros
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-3 pr-4">Competencia</th>
                      <th className="py-3 pr-4">Meses</th>
                      <th className="py-3 pr-4">Doacao</th>
                      <th className="py-3 pr-4">Total</th>
                      <th className="py-3 pr-4">Pagamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td className="py-4 text-slate-500" colSpan={5}>
                          Carregando...
                        </td>
                      </tr>
                    ) : payments.length === 0 ? (
                      <tr>
                        <td className="py-4 text-slate-500" colSpan={5}>
                          Nenhum pagamento registrado.
                        </td>
                      </tr>
                    ) : (
                      payments.map((item) => (
                        <tr key={item.idmensalidade} className="text-slate-700">
                          <td className="py-3 pr-4">
                            {formatDateDisplay(item.competencia)}
                          </td>
                          <td className="py-3 pr-4">{item.meses}</td>
                          <td className="py-3 pr-4">{formatCurrency(item.doacao)}</td>
                          <td className="py-3 pr-4">{formatCurrency(item.valor_total)}</td>
                          <td className="py-3 pr-4">
                            {formatDateDisplay(item.data_pagamento)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Dashboard({ token, onLogout }) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [mensalidadesOpen, setMensalidadesOpen] = useState(false);
  const [mensalidadesInscrito, setMensalidadesInscrito] = useState(null);
  const [mensalidadesRows, setMensalidadesRows] = useState([]);
  const [mensalidadesLoading, setMensalidadesLoading] = useState(false);
  const [mensalidadesError, setMensalidadesError] = useState("");
  const [mensalidadesForm, setMensalidadesForm] = useState({
    competencia: "",
    meses: 1,
    doacao: "",
    data_pagamento: ""
  });

  const filteredSearch = useMemo(() => search.trim(), [search]);

  useEffect(() => {
    let isActive = true;
    const handler = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (filteredSearch) params.set("search", filteredSearch);
        if (statusFilter && statusFilter !== "todos") params.set("status", statusFilter);
        const query = params.toString() ? `?${params.toString()}` : "";
        const response = await apiFetch(`/api/inscritos${query}`, {}, token);
        if (!response.ok) {
          throw new Error("Falha ao carregar");
        }
        const data = await response.json();
        if (isActive) {
          if (Array.isArray(data)) {
            setRows(data);
            setTotalCount(data.length);
            setFilteredCount(data.length);
          } else {
            setRows(data.rows || []);
            setTotalCount(data.total || 0);
            setFilteredCount(data.filtered ?? data.rows?.length ?? 0);
          }
        }
      } catch (err) {
        if (isActive) setError("Nao foi possivel carregar os inscritos.");
      } finally {
        if (isActive) setLoading(false);
      }
    }, 250);
    return () => {
      isActive = false;
      clearTimeout(handler);
    };
  }, [filteredSearch, statusFilter, token]);

  async function handleSave(form) {
    if (!form) return;
    try {
      const response = await apiFetch(`/api/inscritos/${form.idinscritos}`, {
        method: "PUT",
        body: JSON.stringify({
          cpf: form.cpf,
          rua: form.rua,
          numero: form.numero,
          telefone: form.telefone,
          email: form.email,
          profissao: form.profissao
        })
      }, token);
      if (!response.ok) {
        throw new Error("Falha ao salvar");
      }
      setRows((prev) =>
        prev.map((item) => (item.idinscritos === form.idinscritos ? { ...item, ...form } : item))
      );
      setEditing(null);
    } catch (err) {
      setError("Nao foi possivel salvar as alteracoes.");
    }
  }

  function handleOpenMensalidades(row) {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setMensalidadesForm({
      competencia: formatDateInput(firstDay),
      meses: 1,
      doacao: "",
      data_pagamento: formatDateInput(today)
    });
    setMensalidadesInscrito(row);
    setMensalidadesOpen(true);
  }

  async function loadMensalidades(inscritoId) {
    setMensalidadesLoading(true);
    setMensalidadesError("");
    try {
      const response = await apiFetch(`/api/mensalidades?inscrito_id=${inscritoId}`, {}, token);
      if (!response.ok) {
        throw new Error("Falha ao carregar");
      }
      const data = await response.json();
      setMensalidadesRows(data);
      const totalPago = data.reduce((sum, item) => sum + Number(item.valor_total || 0), 0);
      const totalDoacao = data.reduce((sum, item) => sum + Number(item.doacao || 0), 0);
      setRows((prev) =>
        prev.map((item) =>
          item.idinscritos === inscritoId
            ? { ...item, total_pago: totalPago, total_doacao: totalDoacao }
            : item
        )
      );
    } catch (err) {
      setMensalidadesError("Nao foi possivel carregar os pagamentos.");
    } finally {
      setMensalidadesLoading(false);
    }
  }

  useEffect(() => {
    if (mensalidadesOpen && mensalidadesInscrito?.idinscritos) {
      loadMensalidades(mensalidadesInscrito.idinscritos);
    }
  }, [mensalidadesOpen, mensalidadesInscrito, token]);

  async function handleCreateMensalidade() {
    if (!mensalidadesInscrito) return;
    setMensalidadesLoading(true);
    setMensalidadesError("");
    try {
      const response = await apiFetch(
        "/api/mensalidades",
        {
          method: "POST",
          body: JSON.stringify({
            idinscrito: mensalidadesInscrito.idinscritos,
            competencia: mensalidadesForm.competencia,
            meses: mensalidadesForm.meses,
            doacao: mensalidadesForm.doacao,
            data_pagamento: mensalidadesForm.data_pagamento
          })
        },
        token
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao registrar pagamento");
      }
      await loadMensalidades(mensalidadesInscrito.idinscritos);
    } catch (err) {
      setMensalidadesError(err.message || "Nao foi possivel registrar o pagamento.");
    } finally {
      setMensalidadesLoading(false);
    }
  }

  async function handleDeleteMensalidade(idmensalidade) {
    if (!mensalidadesInscrito) return;
    setMensalidadesLoading(true);
    setMensalidadesError("");
    try {
      const response = await apiFetch(`/api/mensalidades/${idmensalidade}`, {
        method: "DELETE"
      }, token);
      if (!response.ok) {
        throw new Error("Falha ao remover pagamento");
      }
      await loadMensalidades(mensalidadesInscrito.idinscritos);
    } catch (err) {
      setMensalidadesError("Nao foi possivel remover o pagamento.");
    } finally {
      setMensalidadesLoading(false);
    }
  }

  function updateMensalidadesField(field, value) {
    setMensalidadesForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="min-h-screen">
      <header className="relative overflow-hidden bg-blue-600 text-white">
        <div className="pointer-events-none absolute -left-20 top-0 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
        <div className="pointer-events-none absolute -right-24 -top-10 h-44 w-44 rounded-full bg-sky-300/30 blur-2xl" />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-white/20 p-1 ring-2 ring-white/30">
              <img
                src={logo}
                alt="Associacao de Moradores Jardim Tarraf II"
                className="h-12 w-12 rounded-full bg-white object-cover"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-blue-100">
                Associacao de Moradores
              </p>
              <h1 className="text-2xl font-display">Jardim Tarraf II</h1>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-blue-100/90">
                Gestao 2026-2027
              </p>
            </div>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25"
            onClick={onLogout}
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-white p-6 shadow-card">
          <div className="pointer-events-none absolute inset-x-0 -top-16 h-32 bg-gradient-to-r from-blue-100/80 via-sky-50 to-cyan-100/60" />
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-display text-slate-900">Associados</h2>
              <p className="mt-2 text-xs text-slate-500">
                Total cadastrados:{" "}
                <span className="font-semibold text-slate-700">{totalCount}</span>{" "}
                - Resultado da busca:{" "}
                <span className="font-semibold text-slate-700">{filteredCount}</span>
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {[
                  { id: "todos", label: "Todos" },
                  { id: "adimplente", label: "Adimplentes" },
                  { id: "inadimplente", label: "Inadimplentes" }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`rounded-md px-3 py-2 ${
                      statusFilter === item.id
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                    onClick={() => setStatusFilter(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Buscar por nome, CPF ou rua"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-3 pr-4">Nome</th>
                  <th className="py-3 pr-4">CPF</th>
                  <th className="py-3 pr-4">Rua</th>
                  <th className="py-3 pr-4">Numero</th>
                  <th className="py-3 pr-4">Telefone</th>
                  <th className="py-3 pr-4">Total pago</th>
                  <th className="py-3 pr-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td className="py-4 text-slate-500" colSpan={7}>
                      Carregando...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="py-4 text-slate-500" colSpan={7}>
                      Nenhum inscrito encontrado.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.idinscritos} className="text-slate-700">
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        {row.nome}
                      </td>
                      <td className="py-3 pr-4">{row.cpf}</td>
                      <td className="py-3 pr-4">{row.rua}</td>
                      <td className="py-3 pr-4">{row.numero}</td>
                      <td className="py-3 pr-4">{row.telefone}</td>
                    <td className="py-3 pr-4">{formatCurrency(row.total_pago)}</td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            onClick={() => handleOpenMensalidades(row)}
                          >
                            Mensalidades
                          </button>
                          <button
                            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                            onClick={() => setEditing(row)}
                          >
                            <PencilLine size={14} />
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <EditModal
        open={Boolean(editing)}
        value={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
      <MensalidadesModal
        open={mensalidadesOpen}
        inscrito={mensalidadesInscrito}
        rows={mensalidadesRows}
        loading={mensalidadesLoading}
        error={mensalidadesError}
        form={mensalidadesForm}
        onChange={updateMensalidadesField}
        onSave={handleCreateMensalidade}
        onDelete={handleDeleteMensalidade}
        onClose={() => {
          setMensalidadesOpen(false);
          setMensalidadesInscrito(null);
          setMensalidadesRows([]);
          setMensalidadesError("");
        }}
      />
    </div>
  );
}

export default function App() {
  const [adminToken, setAdminToken] = useState(() =>
    localStorage.getItem("amjt_admin_token")
  );
  const [userToken, setUserToken] = useState(() =>
    localStorage.getItem("amjt_user_token")
  );

  function handleAdminLogin(newToken) {
    localStorage.setItem("amjt_admin_token", newToken);
    setAdminToken(newToken);
  }

  function handleUserLogin(newToken) {
    localStorage.setItem("amjt_user_token", newToken);
    setUserToken(newToken);
  }

  function handleAdminLogout() {
    localStorage.removeItem("amjt_admin_token");
    setAdminToken(null);
  }

  function handleUserLogout() {
    localStorage.removeItem("amjt_user_token");
    setUserToken(null);
  }

  if (adminToken) {
    return <Dashboard token={adminToken} onLogout={handleAdminLogout} />;
  }

  if (userToken) {
    return <UserDashboard token={userToken} onLogout={handleUserLogout} />;
  }

  return (
    <AccessPortal onAdminLogin={handleAdminLogin} onUserLogin={handleUserLogin} />
  );
}
