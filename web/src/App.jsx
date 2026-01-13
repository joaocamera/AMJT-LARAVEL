import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  LogOut,
  PencilLine,
  Search
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { PDFDocument, StandardFonts } from "pdf-lib";
import logo from "./logo.jpeg";
import qrCode from "./qr-code.svg";

const API_BASE = import.meta.env.VITE_API_URL || "http://192.168.0.14:3001";

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

function apiUpload(path, formData, token, method = "POST") {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${path}`, {
    method,
    body: formData,
    headers
  });
}

function parseAmount(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  let normalized = raw;
  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  }
  normalized = normalized.replace(/[^0-9.-]/g, "");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function formatCurrency(value) {
  const num = parseAmount(value);
  if (!Number.isFinite(num)) {
    return "R$ 0,00";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(num);
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

function formatDateDisplayDash(value) {
  if (!value) return "";
  const datePart = String(value).split("T")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return String(value);
  const [year, month, day] = parts;
  if (!year || !month || !day) return String(value);
  return `${day}-${month}-${year}`;
}

function formatDateDisplayDashShort(value) {
  if (!value) return "";
  const datePart = String(value).split("T")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return String(value);
  const [year, month, day] = parts;
  if (!year || !month || !day) return String(value);
  return `${day}-${month}-${year.slice(-2)}`;
}

function formatCurrencyNoCents(value) {
  const num = parseAmount(value);
  if (!Number.isFinite(num)) {
    return "R$ 0";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

const ASSOCIATION_NAME = "Associacao de Moradores Jardim Tarraf II";
const MONTHLY_FEE = 30;

function escapeCsvValue(value) {
  const str = String(value ?? "");
  if (/[;"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildReportCsv({ tipo, mesLabel, rows, columns, rowMapper }) {
  const generatedAt = new Date().toLocaleDateString("pt-BR");
  const headerLines = [
    ASSOCIATION_NAME,
    `Gerado em: ${generatedAt}`,
    `Tipo: ${tipo}`,
    `Mes de vigencia: ${mesLabel || "-"}`
  ];
  const csvLines = [
    ...headerLines,
    "",
    columns.map(escapeCsvValue).join(";"),
    ...rows.map((row) =>
      rowMapper(row).map(escapeCsvValue).join(";")
    )
  ];
  return csvLines.join("\n");
}

function buildReportPdf({ tipo, mesLabel, rows, columns, rowMapper }) {
  const generatedAt = new Date().toLocaleDateString("pt-BR");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const marginX = 40;
  let cursorY = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(ASSOCIATION_NAME, marginX, cursorY);
  cursorY += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Gerado em: ${generatedAt}`, marginX, cursorY);
  cursorY += 14;
  doc.text(`Tipo: ${tipo}`, marginX, cursorY);
  cursorY += 14;
  doc.text(`Mes de vigencia: ${mesLabel || "-"}`, marginX, cursorY);
  cursorY += 18;

  const bodyRows = rows.map((row) => rowMapper(row));
  const emptyRow = new Array(columns.length).fill("");
  if (emptyRow.length > 1) {
    emptyRow[1] = "Nenhum registro";
  }
  doc.autoTable({
    startY: cursorY,
    head: [columns],
    body: bodyRows.length ? bodyRows : [emptyRow],
    styles: { fontSize: 9, cellPadding: 4, textColor: 40 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      [columns.length - 1]: { halign: "right" }
    }
  });

  return doc.output("blob");
}

function buildBalancetePdf({ mesKey, mesLabel, openingBalance, creditosRows, despesasRows }) {
  const generatedAt = new Date().toLocaleDateString("pt-BR");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const marginX = 40;
  let cursorY = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(ASSOCIATION_NAME, marginX, cursorY);
  cursorY += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Balancete - ${mesLabel || "-"}`, marginX, cursorY);
  cursorY += 14;
  doc.text(`Gerado em: ${generatedAt}`, marginX, cursorY);
  cursorY += 18;

  const creditosCents = creditosRows.reduce(
    (sum, row) => sum + Math.round(parseAmount(row.valor) * 100),
    0
  );
  const despesasCents = despesasRows.reduce(
    (sum, row) => sum + Math.round(parseAmount(row.valor) * 100),
    0
  );
  const creditosTotal = creditosCents / 100;
  const despesasTotal = despesasCents / 100;
  const saldoFinal = Number((openingBalance + creditosTotal - despesasTotal).toFixed(2));
  const [year, month] = (mesKey || "").split("-");
  const monthLabel = month && year ? `${month}/${year}` : "";
  const lastDayDate =
    year && month ? new Date(Number(year), Number(month), 0) : null;
  const lastDayLabel = lastDayDate
    ? lastDayDate.toLocaleDateString("pt-BR")
    : "";

  const resumoRows = [
    {
      label: `Saldo do extrato em 01/${monthLabel || "-"}`,
      value: openingBalance,
      type: "saldo"
    },
    { label: "Total de creditos do mes", value: creditosTotal, type: "credito" },
    { label: "Total de debitos do mes", value: despesasTotal, type: "debito" },
    {
      label: `Saldo final em ${lastDayLabel || "-"}`,
      value: saldoFinal,
      type: "saldo"
    }
  ];

  doc.autoTable({
    startY: cursorY,
    head: [["Descricao", "Valor"]],
    body: resumoRows.map((row) => [row.label, formatCurrency(row.value)]),
    styles: { fontSize: 9, cellPadding: 4, textColor: 40 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 1) return;
      const meta = resumoRows[data.row.index];
      if (!meta) return;
      if (meta.type === "debito") {
        data.cell.styles.textColor = [180, 0, 0];
        return;
      }
      if (meta.type === "saldo" && meta.value < 0) {
        data.cell.styles.textColor = [180, 0, 0];
      }
    }
  });

  cursorY = (doc.lastAutoTable?.finalY || cursorY) + 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Relatorio simplificado de creditos", marginX, cursorY);
  cursorY += 10;

  const creditoColumns = ["Data", "Pagador", "Descricao", "Associado", "Valor"];
  const creditoRows = creditosRows.map((row) => {
    const candidatesLabel = row.candidatos?.length
      ? row.candidatos
          .map((cand) => `${cand.nome} (${Math.round((cand.score || 0) * 100)}%)`)
          .join(" | ")
      : "";
    let associadoLabel = row.associado_nome || "-";
    if (row.match_status === "ambiguous") {
      associadoLabel = candidatesLabel || "Ambiguo";
    } else if (row.match_status === "unmatched") {
      associadoLabel = "Nao encontrado";
    }
    return [
      formatDateDisplay(row.data_credito),
      row.pagador_nome || row.pagador_documento || "-",
      row.descricao || "-",
      associadoLabel,
      formatCurrency(row.valor)
    ];
  });
  const creditoEmpty = new Array(creditoColumns.length).fill("");
  creditoEmpty[1] = "Nenhum registro";
  doc.autoTable({
    startY: cursorY,
    head: [creditoColumns],
    body: creditoRows.length ? creditoRows : [creditoEmpty],
    styles: { fontSize: 9, cellPadding: 4, textColor: [0, 0, 0] },
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { [creditoColumns.length - 1]: { halign: "right" } }
  });

  cursorY = (doc.lastAutoTable?.finalY || cursorY) + 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `Total de creditos: ${formatCurrency(creditosTotal)}`,
    marginX,
    cursorY
  );

  cursorY += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Relatorio simplificado de debitos", marginX, cursorY);
  cursorY += 10;

  const debitoColumns = ["Data", "Beneficiario", "NF", "Descricao", "Valor"];
  const debitoRows = despesasRows.map((row) => [
    formatDateDisplay(row.data_despesa),
    row.beneficiario || "-",
    row.numero_nota || "-",
    row.descricao || "-",
    formatCurrency(row.valor)
  ]);
  const debitoEmpty = new Array(debitoColumns.length).fill("");
  debitoEmpty[1] = "Nenhum registro";
  doc.autoTable({
    startY: cursorY,
    head: [debitoColumns],
    body: debitoRows.length ? debitoRows : [debitoEmpty],
    styles: { fontSize: 9, cellPadding: 4, textColor: [180, 0, 0] },
    headStyles: { fillColor: [30, 64, 175], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { [debitoColumns.length - 1]: { halign: "right" } }
  });

  cursorY = (doc.lastAutoTable?.finalY || cursorY) + 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `Total de debitos: ${formatCurrency(despesasTotal)}`,
    marginX,
    cursorY
  );

  return doc.output("blob");
}

async function mergeBalanceteAnexos({ baseBlob, despesasRows, mesLabel }) {
  const baseBytes = await baseBlob.arrayBuffer();
  const baseDoc = await PDFDocument.load(baseBytes);
  const mergedDoc = await PDFDocument.create();
  const basePages = await mergedDoc.copyPages(baseDoc, baseDoc.getPageIndices());
  basePages.forEach((page) => mergedDoc.addPage(page));

  const anexos = despesasRows.flatMap((row) =>
    Array.isArray(row.anexos) ? row.anexos : []
  );
  if (!anexos.length) {
    const mergedBytes = await mergedDoc.save();
    return new Blob([mergedBytes], { type: "application/pdf" });
  }

  const baseSize = basePages[0]?.getSize?.() || { width: 595.28, height: 841.89 };
  const font = await mergedDoc.embedFont(StandardFonts.Helvetica);
  const titlePage = mergedDoc.addPage([baseSize.width, baseSize.height]);
  titlePage.drawText(`Anexos de despesas - ${mesLabel || "-"}`, {
    x: 40,
    y: baseSize.height - 60,
    size: 14,
    font
  });
  titlePage.drawText(`Total de anexos: ${anexos.length}`, {
    x: 40,
    y: baseSize.height - 80,
    size: 10,
    font
  });

  for (const anexo of anexos) {
    const rawUrl = anexo?.url || "";
    if (!rawUrl) continue;
    const url = rawUrl.startsWith("http") ? rawUrl : `${API_BASE}${rawUrl}`;
    const mimeType = String(anexo?.mimeType || "").toLowerCase();
    const lowerUrl = rawUrl.toLowerCase();
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const buffer = await response.arrayBuffer();
      const isPdf = mimeType.includes("pdf") || lowerUrl.endsWith(".pdf");
      const isPng = mimeType.includes("png") || lowerUrl.endsWith(".png");
      const isJpg =
        mimeType.includes("jpeg") ||
        mimeType.includes("jpg") ||
        lowerUrl.endsWith(".jpg") ||
        lowerUrl.endsWith(".jpeg");
      const isImage = mimeType.startsWith("image/") || isPng || isJpg;
      if (isPdf) {
        const attachmentDoc = await PDFDocument.load(buffer);
        const pages = attachmentDoc.getPages();
        for (const attachmentPage of pages) {
          const embeddedPage = await mergedDoc.embedPage(attachmentPage);
          const page = mergedDoc.addPage([baseSize.width, baseSize.height]);
          const margin = 40;
          const maxWidth = baseSize.width - margin * 2;
          const maxHeight = baseSize.height - margin * 2;
          const scale = Math.min(
            maxWidth / embeddedPage.width,
            maxHeight / embeddedPage.height,
            1
          );
          const drawWidth = embeddedPage.width * scale;
          const drawHeight = embeddedPage.height * scale;
          const x = (baseSize.width - drawWidth) / 2;
          const y = (baseSize.height - drawHeight) / 2;
          page.drawPage(embeddedPage, { x, y, width: drawWidth, height: drawHeight });
        }
      } else if (isImage) {
        if (!isPng && !isJpg) continue;
        const image = isPng
          ? await mergedDoc.embedPng(buffer)
          : await mergedDoc.embedJpg(buffer);
        const page = mergedDoc.addPage([baseSize.width, baseSize.height]);
        const margin = 40;
        const maxWidth = baseSize.width - margin * 2;
        const maxHeight = baseSize.height - margin * 2;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        const x = (baseSize.width - drawWidth) / 2;
        const y = (baseSize.height - drawHeight) / 2;
        page.drawImage(image, { x, y, width: drawWidth, height: drawHeight });
      }
    } catch (err) {
      continue;
    }
  }

  const mergedBytes = await mergedDoc.save();
  return new Blob([mergedBytes], { type: "application/pdf" });
}

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function formatMonthYear(key) {
  if (!key) return "";
  const [year, month] = key.split("-");
  const monthIndex = Number(month) - 1;
  const label = MONTH_LABELS[monthIndex] || key;
  return `${label} ${year || ""}`.trim();
}

function getDespesaMonthKey(row) {
  const dateValue = row?.data_despesa || row?.created_at;
  if (!dateValue) return "";
  return String(dateValue).slice(0, 7);
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

function AddAssociadoModal({ open, onClose, onSave }) {
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    rua: "",
    numero: "",
    telefone: "",
    email: "",
    profissao: ""
  });

  useEffect(() => {
    if (open) {
      setForm({
        nome: "",
        cpf: "",
        rua: "",
        numero: "",
        telefone: "",
        email: "",
        profissao: ""
      });
    }
  }, [open]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-500 font-semibold">
              Cadastro
            </p>
            <h2 className="mt-2 text-xl font-display text-slate-900">
              Adicionar associado
            </h2>
          </div>
          <button
            className="text-sm text-slate-400 hover:text-slate-700"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-600">Nome</label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.nome}
              onChange={(event) => updateField("nome", event.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">CPF</label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.cpf}
              onChange={(event) => updateField("cpf", event.target.value)}
              required
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
          <div>
            <label className="text-sm font-medium text-slate-600">Email</label>
            <input
              type="email"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Profissao</label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.profissao}
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
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function DespesaModal({
  open,
  onClose,
  form,
  onChange,
  onSave,
  existingAnexos,
  newAnexos,
  onAddAnexos,
  onRemoveNewAnexo,
  onRemoveExistingAnexo,
  isEdit
}) {
  if (!open) return null;
  const totalAnexos = (existingAnexos?.length || 0) + (newAnexos?.length || 0);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-500 font-semibold">
              Cadastro
            </p>
            <h2 className="mt-2 text-xl font-display text-slate-900">
              {isEdit ? "Editar despesa" : "Nova despesa"}
            </h2>
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
            <label className="text-sm font-medium text-slate-600">
              Data da despesa
            </label>
            <input
              type="date"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.data_despesa}
              onChange={(event) => onChange("data_despesa", event.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">
              Numero da nota
            </label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.numero_nota}
              onChange={(event) => onChange("numero_nota", event.target.value)}
              placeholder="Ex: 12345"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Valor</label>
            <input
              type="number"
              step="0.01"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.valor}
              onChange={(event) => onChange("valor", event.target.value)}
              placeholder="0,00"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">
              Chave NFE
            </label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.chave_nfe}
              onChange={(event) => onChange("chave_nfe", event.target.value)}
              placeholder="44 digitos"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-600">
              Beneficiario
            </label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.beneficiario}
              onChange={(event) => onChange("beneficiario", event.target.value)}
              placeholder="Fornecedor ou prestador"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-600">
              Descricao
            </label>
            <textarea
              className="mt-2 min-h-[120px] w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={form.descricao}
              onChange={(event) => onChange("descricao", event.target.value)}
              placeholder="Detalhes da despesa"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-600">
              Anexos (max 4)
            </label>
            <input
              type="file"
              multiple
              onChange={onAddAnexos}
              className="mt-2 w-full text-sm text-slate-500"
            />
            <p className="mt-1 text-xs text-slate-400">
              {totalAnexos} de 4 anexos selecionados.
            </p>
            {totalAnexos === 0 ? (
              <p className="mt-2 text-xs text-slate-400">
                Nenhum anexo adicionado.
              </p>
            ) : (
              <div className="mt-3 grid gap-2">
                {(existingAnexos || []).map((anexo) => {
                  const anexoUrl = anexo.url?.startsWith("http")
                    ? anexo.url
                    : `${API_BASE}${anexo.url}`;
                  const isImage = anexo.mimeType?.startsWith("image/");
                  return (
                    <div
                      key={anexo.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        {isImage ? (
                          <img
                            src={anexoUrl}
                            alt={anexo.nome}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-200 text-xs text-slate-600">
                            ARQ
                          </div>
                        )}
                        <a
                          href={anexoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-700 hover:text-blue-600"
                        >
                          {anexo.nome}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveExistingAnexo(anexo.id)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                      >
                        Remover
                      </button>
                    </div>
                  );
                })}
                {(newAnexos || []).map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="text-slate-700">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveNewAnexo(index)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            onClick={onSave}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function DespesasMonthModal({ open, onClose, monthKey, rows }) {
  const [sortBy, setSortBy] = useState("data_desc");
  const [reportUrl, setReportUrl] = useState("");
  const [reportFileName, setReportFileName] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const total = rows.reduce((sum, row) => sum + Number(row.valor || 0), 0);
  const sortedRows = useMemo(() => {
    const list = [...rows];
    switch (sortBy) {
      case "valor_asc":
        return list.sort((a, b) => Number(a.valor || 0) - Number(b.valor || 0));
      case "valor_desc":
        return list.sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));
      case "data_asc":
        return list.sort(
          (a, b) =>
            String(a.data_despesa || "").localeCompare(String(b.data_despesa || ""))
        );
      case "data_desc":
      default:
        return list.sort(
          (a, b) =>
            String(b.data_despesa || "").localeCompare(String(a.data_despesa || ""))
        );
    }
  }, [rows, sortBy]);
  const printDate = new Date().toLocaleDateString("pt-BR");
  const monthLabel = formatMonthYear(monthKey);

  useEffect(() => {
    if (!open) return;
    setReportBusy(true);
    setReportUrl("");
    const columns = ["Data", "Beneficiario", "Descricao", "Valor"];
    const rowMapper = (row) => [
      formatDateDisplay(row.data_despesa),
      row.beneficiario || "-",
      row.descricao || "-",
      formatCurrency(row.valor)
    ];
    try {
      const csvContent = buildReportCsv({
        tipo: "Debito",
        mesLabel: monthLabel,
        rows: sortedRows,
        columns,
        rowMapper
      });
      void csvContent;
      const pdfBlob = buildReportPdf({
        tipo: "Debito",
        mesLabel: monthLabel,
        rows: sortedRows,
        columns,
        rowMapper
      });
      const url = URL.createObjectURL(pdfBlob);
      setReportUrl((prev) => {
        if (prev && prev !== url) {
          URL.revokeObjectURL(prev);
        }
        return url;
      });
      const safeMonth = monthKey || "periodo";
      setReportFileName(`relatorio-despesas-${safeMonth}.pdf`);
      return () => {
        URL.revokeObjectURL(url);
      };
    } finally {
      setReportBusy(false);
    }
  }, [open, monthKey, monthLabel, sortedRows]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white p-6 shadow-card print-area">
        <div className="print-only hidden mb-4 border-b border-slate-200 pb-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Associacao de Moradores Jardim Tarraf II
          </p>
          <h2 className="mt-2 text-lg font-display text-slate-900">
            Relatorio de Despesas - {formatMonthYear(monthKey)}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Gerado em: {printDate}
          </p>
        </div>
        <div className="print-only hidden">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-3 pr-4">Data</th>
                <th className="py-3 pr-4">Beneficiario</th>
                <th className="py-3 pr-4">Descricao</th>
                <th className="py-3 pr-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRows.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={4}>
                    Nenhuma despesa encontrada.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr key={row.iddespesa} className="text-slate-700">
                    <td className="py-3 pr-4">
                      {formatDateDisplay(row.data_despesa)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900">
                      {row.beneficiario}
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      {row.descricao || "-"}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-slate-700">
                      {formatCurrency(row.valor)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-500 font-semibold">
              Despesas do mes
            </p>
            <h2 className="mt-2 text-xl font-display text-slate-900">
              {formatMonthYear(monthKey)}
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              Total:{" "}
              <span className="font-semibold text-slate-700">
                {formatCurrency(total)}
              </span>{" "}
              - Registros:{" "}
              <span className="font-semibold text-slate-700">{rows.length}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {reportUrl ? (
              <a
                className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 no-print"
                href={reportUrl}
                download={reportFileName}
              >
                Baixar PDF
              </a>
            ) : (
              <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-400 no-print">
                {reportBusy ? "Gerando PDF..." : "PDF indisponivel"}
              </span>
            )}
            <button
              className="text-sm text-slate-400 hover:text-slate-700 no-print"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="uppercase tracking-[0.2em]">Ordenar</span>
            <select
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 no-print"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="data_desc">Data (mais recente)</option>
              <option value="data_asc">Data (mais antiga)</option>
              <option value="valor_desc">Valor (maior)</option>
              <option value="valor_asc">Valor (menor)</option>
            </select>
          </div>
          <span className="no-print" />
        </div>

        <div className="mt-4 flex-1 overflow-y-auto print-scroll print-hide">
          <div className="min-w-full overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-3 pr-4">Data</th>
                <th className="py-3 pr-4">Beneficiario</th>
                <th className="py-3 pr-4">Descricao</th>
                <th className="py-3 pr-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {sortedRows.length === 0 ? (
                  <tr>
                    <td className="py-4 text-slate-500" colSpan={4}>
                      Nenhuma despesa encontrada.
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row) => (
                    <tr key={row.iddespesa} className="text-slate-700">
                      <td className="py-3 pr-4">
                        {formatDateDisplay(row.data_despesa)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900">
                      {row.beneficiario}
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      {row.descricao || "-"}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-slate-700">
                      {formatCurrency(row.valor)}
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
  );
}

function ReceitasMonthModal({
  open,
  onClose,
  monthKey,
  rows,
  onSelect,
  onLink,
  onUnlink,
  associados
}) {
  const [sortBy, setSortBy] = useState("data_desc");
  const [filterBy, setFilterBy] = useState("todos");
  const [reportUrl, setReportUrl] = useState("");
  const [reportFileName, setReportFileName] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [manualSearch, setManualSearch] = useState({});
  const [manualPick, setManualPick] = useState({});
  const total = rows.reduce((sum, row) => sum + Number(row.valor || 0), 0);
  const matched = useMemo(
    () => rows.filter((row) => row.match_status === "matched" || row.match_status === "importado"),
    [rows]
  );
  const ambiguous = useMemo(
    () => rows.filter((row) => row.match_status === "ambiguous"),
    [rows]
  );
  const unmatched = useMemo(
    () => rows.filter((row) => row.match_status === "unmatched"),
    [rows]
  );
  const filteredRows = useMemo(() => {
    switch (filterBy) {
      case "ambiguous":
        return ambiguous;
      case "unmatched":
        return unmatched;
      case "matched":
        return matched;
      case "todos":
      default:
        return rows;
    }
  }, [ambiguous, unmatched, matched, rows, filterBy]);
  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    switch (sortBy) {
      case "valor_asc":
        return list.sort((a, b) => Number(a.valor || 0) - Number(b.valor || 0));
      case "valor_desc":
        return list.sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));
      case "data_asc":
        return list.sort(
          (a, b) =>
            String(a.data_credito || "").localeCompare(String(b.data_credito || ""))
        );
      case "data_desc":
      default:
        return list.sort(
          (a, b) =>
            String(b.data_credito || "").localeCompare(String(a.data_credito || ""))
        );
    }
  }, [filteredRows, sortBy]);
  const printDate = new Date().toLocaleDateString("pt-BR");
  const monthLabel = formatMonthYear(monthKey);
  const associadosSafe = Array.isArray(associados) ? associados : [];

  function getAssociadoOptions(query) {
    const term = normalizeText(query);
    const digits = String(query || "").replace(/\D/g, "");
    if (!term && !digits) {
      return associadosSafe.slice(0, 8);
    }
    return associadosSafe
      .filter((item) => {
        const name = normalizeText(item.nome);
        const cpf = String(item.cpf || "").replace(/\D/g, "");
        return (term && name.includes(term)) || (digits && cpf.includes(digits));
      })
      .slice(0, 8);
  }

  useEffect(() => {
    if (!open) return;
    setReportBusy(true);
    setReportUrl("");
    const columns = ["Data", "Pagador", "Descricao", "Associado", "Valor"];
    const rowMapper = (row) => {
      const candidatesLabel = row.candidatos?.length
        ? row.candidatos
            .map(
              (cand) =>
                `${cand.nome} (${Math.round((cand.score || 0) * 100)}%)`
            )
            .join(" | ")
        : "";
      let associadoLabel = row.associado_nome || "-";
      if (row.match_status === "ambiguous") {
        associadoLabel = candidatesLabel || "Ambiguo";
      } else if (row.match_status === "unmatched") {
        associadoLabel = "Nao encontrado";
      }
      return [
        formatDateDisplay(row.data_credito),
        row.pagador_nome || row.pagador_documento || "-",
        row.descricao || "-",
        associadoLabel,
        formatCurrency(row.valor)
      ];
    };
    try {
      const csvContent = buildReportCsv({
        tipo: "Credito",
        mesLabel: monthLabel,
        rows: sortedRows,
        columns,
        rowMapper
      });
      void csvContent;
      const pdfBlob = buildReportPdf({
        tipo: "Credito",
        mesLabel: monthLabel,
        rows: sortedRows,
        columns,
        rowMapper
      });
      const url = URL.createObjectURL(pdfBlob);
      setReportUrl((prev) => {
        if (prev && prev !== url) {
          URL.revokeObjectURL(prev);
        }
        return url;
      });
      const safeMonth = monthKey || "periodo";
      setReportFileName(`relatorio-creditos-${safeMonth}.pdf`);
      return () => {
        URL.revokeObjectURL(url);
      };
    } finally {
      setReportBusy(false);
    }
  }, [open, monthKey, monthLabel, sortedRows]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="flex max-h-[85vh] w-full max-w-5xl flex-col rounded-2xl bg-white p-6 shadow-card print-area">
        <div className="print-only hidden mb-4 border-b border-slate-200 pb-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Associacao de Moradores Jardim Tarraf II
          </p>
          <h2 className="mt-2 text-lg font-display text-slate-900">
            Relatorio de Receitas - {formatMonthYear(monthKey)}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Gerado em: {printDate}
          </p>
        </div>
        <div className="print-only hidden">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-3 pr-4">Data</th>
                <th className="py-3 pr-4">Pagador</th>
                <th className="py-3 pr-4">Descricao</th>
                <th className="py-3 pr-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRows.length === 0 ? (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={4}>
                    Nenhum credito encontrado.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr key={row.idcredito} className="text-slate-700">
                    <td className="py-3 pr-4">
                      {formatDateDisplay(row.data_credito)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900">
                      {row.pagador_nome || row.pagador_documento || "-"}
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      {row.descricao || "-"}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-slate-700">
                      {formatCurrency(row.valor)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-500 font-semibold">
              Receitas
            </p>
            <h2 className="mt-2 text-xl font-display text-slate-900">
              {formatMonthYear(monthKey)}
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              Total:{" "}
              <span className="font-semibold text-slate-700">
                {formatCurrency(total)}
              </span>{" "}
              - Registros:{" "}
              <span className="font-semibold text-slate-700">{rows.length}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {reportUrl ? (
              <a
                className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 no-print"
                href={reportUrl}
                download={reportFileName}
              >
                Baixar PDF
              </a>
            ) : (
              <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-400 no-print">
                {reportBusy ? "Gerando PDF..." : "PDF indisponivel"}
              </span>
            )}
            <button
              className="text-sm text-slate-400 hover:text-slate-700 no-print"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-3 no-print">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
              Encontrados: {matched.length}
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
              Ambiguos: {ambiguous.length}
            </span>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
              Nao encontrados: {unmatched.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            {[
              { id: "todos", label: "Todos" },
              { id: "matched", label: "Encontrados" },
              { id: "ambiguous", label: "Ambiguos" },
              { id: "unmatched", label: "Nao encontrados" }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  filterBy === item.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                onClick={() => setFilterBy(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 no-print">
            <span className="uppercase tracking-[0.2em]">Ordenar</span>
            <select
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 no-print"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="data_desc">Data (mais recente)</option>
              <option value="data_asc">Data (mais antiga)</option>
              <option value="valor_desc">Valor (maior)</option>
              <option value="valor_asc">Valor (menor)</option>
            </select>
          </div>
          <span className="no-print" />
        </div>

        <div className="mt-4 flex-1 overflow-y-auto print-scroll print-hide">
          <div className="min-w-full overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-3 pr-4">Data</th>
                  <th className="py-3 pr-4">Pagador</th>
                  <th className="py-3 pr-4">Descricao</th>
                  <th className="py-3 pr-4">Associado</th>
                  <th className="py-3 pr-4 print-hide">Status</th>
                  <th className="py-3 pr-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRows.length === 0 ? (
                  <tr>
                    <td className="py-4 text-slate-500" colSpan={5}>
                      Nenhum credito encontrado.
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row) => (
                    <tr key={row.idcredito} className="text-slate-700">
                      <td className="py-3 pr-4">
                        {formatDateDisplay(row.data_credito)}
                      </td>
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        {row.pagador_nome || row.pagador_documento || "-"}
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {row.descricao || "-"}
                      </td>
                      <td className="py-3 pr-4">
                        {row.match_status === "matched" ||
                        row.match_status === "importado" ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-emerald-600">
                              {row.associado_nome || "Encontrado"}
                            </span>
                            {row.match_status === "matched" &&
                            row.match_origin === "manual" ? (
                              <button
                                type="button"
                                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                onClick={() => onUnlink?.(row.idcredito)}
                              >
                                Remover vinculo
                              </button>
                            ) : null}
                          </div>
                        ) : row.match_status === "unmatched" ? (
                          <div className="flex flex-col gap-2">
                            <input
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                              placeholder="Buscar associado"
                              value={manualSearch[row.idcredito] || ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                setManualSearch((prev) => ({
                                  ...prev,
                                  [row.idcredito]: value
                                }));
                                setManualPick((prev) => ({
                                  ...prev,
                                  [row.idcredito]: ""
                                }));
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <select
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                                value={manualPick[row.idcredito] || ""}
                                onChange={(event) =>
                                  setManualPick((prev) => ({
                                    ...prev,
                                    [row.idcredito]: event.target.value
                                  }))
                                }
                              >
                                <option value="">Selecionar</option>
                                {getAssociadoOptions(
                                  manualSearch[row.idcredito]
                                ).map((item) => (
                                  <option
                                    key={item.idinscritos}
                                    value={item.idinscritos}
                                  >
                                    {item.nome} ({item.cpf || "CPF/CNPJ"})
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                                onClick={() =>
                                  onLink?.(
                                    row.idcredito,
                                    manualPick[row.idcredito]
                                  )
                                }
                                disabled={!manualPick[row.idcredito]}
                              >
                                Vincular
                              </button>
                            </div>
                          </div>
                        ) : row.candidatos?.length ? (
                          <select
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                            onChange={(event) =>
                              onSelect?.(row.idcredito, event.target.value)
                            }
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Selecionar
                            </option>
                            {row.candidatos.map((cand) => (
                              <option key={cand.idinscrito} value={cand.idinscrito}>
                                {cand.nome} ({Math.round(cand.score * 100)}%)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-rose-600">Nao encontrado</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 print-hide">
                        {row.match_status === "matched" || row.match_status === "importado" ? (
                          <span className="text-emerald-600">Encontrado</span>
                        ) : row.match_status === "ambiguous" ? (
                          <span className="text-amber-600">Ambiguo</span>
                        ) : (
                          <span className="text-rose-600">Nao encontrado</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold text-slate-700">
                        {formatCurrency(row.valor)}
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
  );
}

function ReceitasImportModal({
  open,
  onClose,
  onParse,
  onImport,
  onSelectMatch,
  loading,
  error,
  rows,
  fileName,
  result
}) {
  const [file, setFile] = useState(null);
  const matchedCount = rows.filter(
    (row) => row.match_status === "matched" || row.match_status === "importado"
  ).length;
  const ambiguousCount = rows.filter((row) => row.match_status === "ambiguous").length;
  const unmatchedCount = rows.filter((row) => row.match_status === "unmatched").length;

  useEffect(() => {
    if (!open) return;
    setFile(null);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="flex max-h-[85vh] w-full max-w-5xl flex-col rounded-2xl bg-white p-6 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-500 font-semibold">
              Importacao
            </p>
            <h2 className="mt-2 text-xl font-display text-slate-900">
              Importar creditos do extrato
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              O sistema tenta cruzar com associados e gera uma analise.
            </p>
          </div>
          <button
            className="text-sm text-slate-400 hover:text-slate-700"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <input
            type="file"
            accept="application/pdf"
            className="text-sm"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          {fileName ? (
            <p className="text-xs text-slate-400">Arquivo: {fileName}</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onParse(file)}
              disabled={!file || loading}
            >
              {loading ? "Processando..." : "Analisar extrato"}
            </button>
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onImport}
              disabled={!rows.length || loading}
            >
              Importar mensalidades
            </button>
          </div>
          {rows.length ? (
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                Encontrados: {matchedCount}
              </span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                Ambiguos: {ambiguousCount}
              </span>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">
                Nao encontrados: {unmatchedCount}
              </span>
            </div>
          ) : null}
          {result ? (
            <p className="text-sm text-slate-600">
              Importadas:{" "}
              <span className="font-semibold text-slate-800">
                {result.inserted ?? 0}
              </span>{" "}
              - Ignoradas:{" "}
              <span className="font-semibold text-slate-800">
                {result.skipped ?? 0}
              </span>
            </p>
          ) : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          <div className="min-w-full overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-3 pr-4">Data</th>
                  <th className="py-3 pr-4">Pagador</th>
                  <th className="py-3 pr-4">Descricao</th>
                  <th className="py-3 pr-4">Associado</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td className="py-4 text-slate-500" colSpan={6}>
                      Nenhum credito carregado.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.idcredito} className="text-slate-700">
                      <td className="py-3 pr-4">
                        {formatDateDisplay(row.data_credito)}
                      </td>
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        {row.pagador_nome || row.pagador_documento || "-"}
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {row.descricao || "-"}
                      </td>
                      <td className="py-3 pr-4">
                        {row.match_status === "matched" || row.match_status === "importado" ? (
                          <span className="text-emerald-600">
                            {row.associado_nome || "Encontrado"}
                          </span>
                        ) : row.candidatos?.length ? (
                          <select
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                            onChange={(event) =>
                              onSelectMatch(row.idcredito, event.target.value)
                            }
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Selecionar
                            </option>
                            {row.candidatos.map((cand) => (
                              <option key={cand.idinscrito} value={cand.idinscrito}>
                                {cand.nome} ({Math.round(cand.score * 100)}%)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-rose-600">Nao encontrado</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {row.match_status === "matched" || row.match_status === "importado" ? (
                          <span className="text-emerald-600">Encontrado</span>
                        ) : row.match_status === "ambiguous" ? (
                          <span className="text-amber-600">Ambiguo</span>
                        ) : (
                          <span className="text-rose-600">Nao encontrado</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold text-slate-700">
                        {formatCurrency(row.valor)}
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
  );
}

function DespesasImportModal({
  open,
  onClose,
  onParse,
  onImport,
  loading,
  error,
  rows,
  fileName,
  result
}) {
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white p-6 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-500 font-semibold">
              Importacao
            </p>
            <h2 className="mt-2 text-xl font-display text-slate-900">
              Importar extrato
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Envie o PDF do extrato para identificar as despesas.
            </p>
          </div>
          <button
            className="text-sm text-slate-400 hover:text-slate-700"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <input
            type="file"
            accept="application/pdf"
            className="text-sm"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          {fileName ? (
            <p className="text-xs text-slate-400">Arquivo: {fileName}</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onParse(file)}
              disabled={!file || loading}
            >
              {loading ? "Processando..." : "Analisar extrato"}
            </button>
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onImport}
              disabled={!rows.length || loading}
            >
              Importar despesas
            </button>
          </div>
          {result ? (
            <p className="text-sm text-slate-600">
              Importadas:{" "}
              <span className="font-semibold text-slate-800">
                {result.inserted ?? 0}
              </span>{" "}
              - Ignoradas:{" "}
              <span className="font-semibold text-slate-800">
                {result.skipped ?? 0}
              </span>
            </p>
          ) : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          <div className="min-w-full overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-3 pr-4">Data</th>
                  <th className="py-3 pr-4">Beneficiario</th>
                  <th className="py-3 pr-4">Descricao</th>
                  <th className="py-3 pr-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td className="py-4 text-slate-500" colSpan={4}>
                      Nenhuma despesa carregada.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={`${row.data_despesa}-${index}`} className="text-slate-700">
                      <td className="py-3 pr-4">
                        {formatDateDisplay(row.data_despesa)}
                      </td>
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        {row.beneficiario}
                      </td>
                      <td className="py-3 pr-4 text-slate-500">
                        {row.descricao || "-"}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold text-slate-700">
                        {formatCurrency(row.valor)}
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
  );
}

function formatDateInput(value) {
  return value.toISOString().slice(0, 10);
}

function PollOptionsList({ options, onVote, votedOption }) {
  return (
    <div className="mt-4 grid gap-2">
      {options.map((option) => {
        const isSelected = votedOption === option.idopcao;
        return (
          <button
            key={option.idopcao}
            type="button"
            className={`flex items-center justify-between rounded-lg border px-4 py-2 text-sm ${
              votedOption
                ? "cursor-default border-slate-200 bg-slate-50 text-slate-600"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
            } ${isSelected ? "border-blue-300 bg-blue-50 text-blue-700" : ""}`}
            onClick={() => (votedOption ? null : onVote(option.idopcao))}
            disabled={Boolean(votedOption)}
          >
            <span>{option.texto}</span>
            {votedOption ? (
              <span className="text-xs font-semibold text-slate-500">
                {option.votos} votos
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
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
                    <td className="py-3 pr-4">
                      {formatDateDisplayDash(row.competencia)}
                    </td>
                    <td className="py-3 pr-4">{row.meses}</td>
                    <td className="py-3 pr-4">R$ {Number(row.doacao || 0).toFixed(2)}</td>
                    <td className="py-3 pr-4">R$ {Number(row.valor_total || 0).toFixed(2)}</td>
                    <td className="py-3 pr-4">
                      {formatDateDisplayDash(row.data_pagamento)}
                    </td>
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

function AdminEnquetes({ token }) {
  const [enquetes, setEnquetes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    opcoes: ["", ""]
  });

  async function loadEnquetes() {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/enquetes", {}, token);
      if (!response.ok) {
        throw new Error("Falha ao carregar");
      }
      const data = await response.json();
      setEnquetes(data || []);
    } catch (err) {
      setError("Nao foi possivel carregar as enquetes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEnquetes();
  }, [token]);

  function updateOption(index, value) {
    setForm((prev) => {
      const next = [...prev.opcoes];
      next[index] = value;
      return { ...prev, opcoes: next };
    });
  }

  function addOption() {
    setForm((prev) =>
      prev.opcoes.length >= 4 ? prev : { ...prev, opcoes: [...prev.opcoes, ""] }
    );
  }

  function removeOption(index) {
    setForm((prev) => {
      const next = prev.opcoes.filter((_, idx) => idx !== index);
      return { ...prev, opcoes: next.length >= 2 ? next : prev.opcoes };
    });
  }

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const response = await apiFetch(
        "/api/enquetes",
        {
          method: "POST",
          body: JSON.stringify({
            titulo: form.titulo,
            descricao: form.descricao,
            opcoes: form.opcoes
          })
        },
        token
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao criar");
      }
      setForm({ titulo: "", descricao: "", opcoes: ["", ""] });
      await loadEnquetes();
    } catch (err) {
      setError(err.message || "Nao foi possivel criar a enquete.");
    } finally {
      setCreating(false);
    }
  }

  async function updateStatus(id, status) {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(
        `/api/enquetes/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({ status })
        },
        token
      );
      if (!response.ok) {
        throw new Error("Falha ao atualizar");
      }
      await loadEnquetes();
    } catch (err) {
      setError("Nao foi possivel atualizar a enquete.");
    } finally {
      setLoading(false);
    }
  }

  async function updateEnquete(id, updates) {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(
        `/api/enquetes/${id}`,
        {
          method: "PUT",
          body: JSON.stringify(updates)
        },
        token
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao atualizar");
      }
      await loadEnquetes();
    } catch (err) {
      setError(err.message || "Nao foi possivel atualizar a enquete.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-display text-slate-900">Enquetes</h2>
          <p className="text-sm text-slate-500">
            Crie e acompanhe as enquetes da associacao.
          </p>
        </div>
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          onClick={() => setCreating((prev) => !prev)}
        >
          {creating ? "Fechar" : "Nova enquete"}
        </button>
      </div>

      {creating ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-600">Titulo</label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.titulo}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, titulo: event.target.value }))
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-600">Descricao</label>
              <textarea
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                rows={3}
                value={form.descricao}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, descricao: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-slate-600">Opcoes</p>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {form.opcoes.map((option, index) => (
                <div key={`option-${index}`} className="flex items-center gap-2">
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={option}
                    onChange={(event) => updateOption(index, event.target.value)}
                  />
                  {form.opcoes.length > 2 ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                      onClick={() => removeOption(index)}
                    >
                      Remover
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">Maximo de 4 opcoes.</p>
              <button
                type="button"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                onClick={addOption}
                disabled={form.opcoes.length >= 4}
              >
                Adicionar opcao
              </button>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleCreate}
              disabled={!form.titulo.trim() || form.opcoes.length < 2}
            >
              Criar enquete
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-6 grid gap-4">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando enquetes...</p>
        ) : enquetes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma enquete criada.</p>
        ) : (
          enquetes.map((poll) => (
            <AdminEnqueteCard
              key={poll.idenquete}
              poll={poll}
              onStatusChange={updateStatus}
              onSave={updateEnquete}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AdminEnqueteCard({ poll, onStatusChange, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [titulo, setTitulo] = useState(poll.titulo || "");
  const [descricao, setDescricao] = useState(poll.descricao || "");

  useEffect(() => {
    setTitulo(poll.titulo || "");
    setDescricao(poll.descricao || "");
  }, [poll.titulo, poll.descricao]);

  async function handleSave() {
    await onSave(poll.idenquete, { titulo, descricao });
    setIsEditing(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          {isEditing ? (
            <div className="grid gap-2">
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={titulo}
                onChange={(event) => setTitulo(event.target.value)}
              />
              <textarea
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                rows={2}
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
              />
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-slate-900">{poll.titulo}</p>
              {poll.descricao ? (
                <p className="text-xs text-slate-500">{poll.descricao}</p>
              ) : null}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              poll.status === "aberta"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {poll.status === "aberta" ? "Aberta" : "Encerrada"}
          </span>
          <button
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            onClick={() =>
              onStatusChange(
                poll.idenquete,
                poll.status === "aberta" ? "encerrada" : "aberta"
              )
            }
          >
            {poll.status === "aberta" ? "Encerrar" : "Reabrir"}
          </button>
          <button
            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
            onClick={() => setIsEditing((prev) => !prev)}
          >
            {isEditing ? "Cancelar" : "Editar"}
          </button>
          {isEditing ? (
            <button
              className={`text-xs font-semibold ${
                titulo.trim()
                  ? "text-blue-600 hover:text-blue-700"
                  : "cursor-not-allowed text-slate-300"
              }`}
              onClick={handleSave}
              disabled={!titulo.trim()}
            >
              Salvar
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {poll.opcoes.map((option) => (
          <div
            key={option.idopcao}
            className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs text-slate-600"
          >
            <span>{option.texto}</span>
            <span className="font-semibold">{option.votos} votos</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminEnquetesModal({ open, onClose, token }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-500 font-semibold">
              Enquetes
            </p>
            <h2 className="mt-2 text-xl font-display text-slate-900">
              Administrar enquetes
            </h2>
          </div>
          <button
            className="text-sm text-slate-400 hover:text-slate-700"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
        <div className="mt-6">
          <AdminEnquetes token={token} />
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
  const [polls, setPolls] = useState([]);
  const [pollsError, setPollsError] = useState("");
  const [pollsLoading, setPollsLoading] = useState(true);
  const [qrCopyStatus, setQrCopyStatus] = useState("");

  useEffect(() => {
    let isActive = true;
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [profileRes, paymentsRes] = await Promise.all([
          apiFetch("/api/associado/me", {}, token),
          apiFetch("/api/associado/pagamentos?all=1", {}, token)
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

  useEffect(() => {
    let isActive = true;
    async function loadPolls() {
      setPollsLoading(true);
      setPollsError("");
      try {
        const response = await apiFetch("/api/associado/enquetes", {}, token);
        if (!response.ok) {
          throw new Error("Falha ao carregar");
        }
        const data = await response.json();
        if (isActive) setPolls(data || []);
      } catch (err) {
        if (isActive) setPollsError("Nao foi possivel carregar as enquetes.");
      } finally {
        if (isActive) setPollsLoading(false);
      }
    }
    loadPolls();
    return () => {
      isActive = false;
    };
  }, [token]);

  async function handleVote(idenquete, idopcao) {
    setPollsError("");
    try {
      const response = await apiFetch(
        `/api/associado/enquetes/${idenquete}/votar`,
        {
          method: "POST",
          body: JSON.stringify({ idopcao })
        },
        token
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao votar");
      }
      const data = await response.json();
      setPolls(data || []);
    } catch (err) {
      setPollsError(err.message || "Nao foi possivel registrar seu voto.");
    }
  }

  function copyTextWithExecCommand(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  }

  async function handleCopyQrCode() {
    if (qrCopyStatus === "loading") return;
    setQrCopyStatus("loading");
    try {
      const pixPayload = "05152486000105";
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pixPayload);
        setQrCopyStatus("success");
        return;
      }
      const copied = copyTextWithExecCommand(pixPayload);
      if (!copied) {
        throw new Error("Clipboard indisponivel");
      }
      setQrCopyStatus("success");
    } catch (err) {
      setQrCopyStatus("error");
    } finally {
      setTimeout(() => setQrCopyStatus(""), 4000);
    }
  }

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

  const sortedPayments = useMemo(() => {
    return [...payments].sort((a, b) =>
      String(b.competencia || "").localeCompare(String(a.competencia || ""))
    );
  }, [payments]);
  const totalPago = sortedPayments.reduce(
    (sum, item) => sum + Number(item.valor_total || 0),
    0
  );
  const { totalPago12m, totalDoacao12m } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setMonth(cutoff.getMonth() - 12);
    return payments.reduce(
      (acc, item) => {
        const competenciaDate = item.competencia ? new Date(item.competencia) : null;
        if (!competenciaDate || Number.isNaN(competenciaDate.getTime())) {
          return acc;
        }
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
    <div className="min-h-screen">
      <style>{`
        @media print {
          body {
            background: #ffffff;
          }
          body * {
            visibility: hidden;
          }
          .print-area,
          .print-area * {
            visibility: visible;
          }
          .no-print,
          .print-hide {
            display: none !important;
          }
          .print-area {
            position: static !important;
            max-height: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            display: block !important;
          }
          .print-scroll {
            overflow: visible !important;
            max-height: none !important;
            flex: none !important;
          }
          .print-only {
            display: block !important;
          }
          .print-only.hidden {
            display: block !important;
          }
          table {
            width: 100% !important;
            font-size: 11px !important;
          }
          th, td {
            padding: 6px 8px !important;
            vertical-align: top !important;
          }
        }
        .print-only {
          display: none;
        }
      `}</style>
      <header className="relative overflow-hidden bg-blue-600 text-white">
        <div className="pointer-events-none absolute -left-20 top-0 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
        <div className="pointer-events-none absolute -right-24 -top-10 h-44 w-44 rounded-full bg-sky-300/30 blur-2xl" />
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-white/20 p-1 ring-2 ring-white/30">
              <img
                src={logo}
                alt="Associacao de Moradores Jardim Tarraf II"
                className="h-10 w-10 rounded-full bg-white object-cover sm:h-12 sm:w-12"
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25 sm:w-auto"
            onClick={onLogout}
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="mb-4 text-sm text-emerald-600">{message}</p> : null}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl bg-white p-6 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                className="w-full rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                onClick={handleSaveProfile}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar alteracoes"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-2xl bg-white p-6 shadow-card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-display text-slate-900">
                    Enquetes
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Participe das enquetes da associacao.
                  </p>
                </div>
                <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                  {polls.length} enquete(s)
                </div>
              </div>
              {pollsError ? (
                <p className="mt-3 text-sm text-rose-600">{pollsError}</p>
              ) : null}
              {pollsLoading ? (
                <p className="mt-3 text-sm text-slate-500">Carregando enquetes...</p>
              ) : polls.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Nenhuma enquete ativa.</p>
              ) : (
                <div className="mt-4 grid gap-4">
                  {polls.map((poll) => (
                    <div
                      key={poll.idenquete}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {poll.titulo}
                          </p>
                          {poll.descricao ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {poll.descricao}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            poll.status === "aberta"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {poll.status === "aberta" ? "Aberta" : "Encerrada"}
                        </span>
                      </div>
                      <PollOptionsList
                        options={poll.opcoes}
                        votedOption={poll.voto_idopcao}
                        onVote={(idopcao) => handleVote(poll.idenquete, idopcao)}
                      />
                      {poll.voto_idopcao ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Obrigado pelo voto! Confira o resultado acima.
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-card">
              <h3 className="text-lg font-display text-slate-900">
                QR Code para pagamento
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <button
                  type="button"
                  onClick={handleCopyQrCode}
                  disabled={qrCopyStatus === "loading"}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {qrCopyStatus === "loading"
                    ? "Copiando..."
                    : "Copiar chave CNPJ"}
                </button>
                {qrCopyStatus === "success" ? (
                  <span className="text-xs font-semibold text-emerald-600">
                    CNPJ copiado.
                  </span>
                ) : qrCopyStatus === "error" ? (
                  <span className="text-xs font-semibold text-rose-600">
                    Nao foi possivel copiar.
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                <img
                  src={qrCode}
                  alt="QR Code para pagamento"
                  className="h-48 w-48"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-display text-slate-900">
                    Pagamentos
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Total pago: {formatCurrencyNoCents(totalPago)}
                  </p>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                  {payments.length} registros
                </div>
              </div>
              {totalPago12m >= 360 && totalDoacao12m > 0 ? (
                <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Prezado Associado, obrigado por suas doações, você não tem débitos com a associação.
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:hidden">
                {loading ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Carregando...
                  </div>
                ) : payments.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Nenhum pagamento registrado.
                  </div>
                ) : (
                  sortedPayments.map((item) => (
                    <div
                      key={item.idmensalidade}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
                    >
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                        <span>Competencia</span>
                        <span>{formatDateDisplayDashShort(item.competencia)}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <span>Pagamento</span>
                        <span className="text-right text-slate-700">
                          {formatCurrencyNoCents(MONTHLY_FEE)}
                        </span>
                        <span>Doacao</span>
                        <span className="text-right text-slate-700">
                          {formatCurrencyNoCents(item.doacao)}
                        </span>
                        <span>Total</span>
                        <span className="text-right font-semibold text-slate-800">
                          {formatCurrencyNoCents(item.valor_total)}
                        </span>
                        <span>Pagamento</span>
                        <span className="text-right text-slate-700">
                          {formatDateDisplayDashShort(item.data_pagamento)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 hidden overflow-x-auto sm:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-3 pr-4">Competencia</th>
                      <th className="py-3 pr-4">Pagamento</th>
                      <th className="py-3 pr-4">Doacao</th>
                      <th className="py-3 pr-4">Total</th>
                      <th className="py-3 pr-4">Data pagamento</th>
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
                      sortedPayments.map((item) => (
                        <tr key={item.idmensalidade} className="text-slate-700">
                          <td className="py-3 pr-4">
                            {formatDateDisplayDashShort(item.competencia)}
                          </td>
                          <td className="py-3 pr-4">
                            {formatCurrencyNoCents(MONTHLY_FEE)}
                          </td>
                          <td className="py-3 pr-4">
                            {formatCurrencyNoCents(item.doacao)}
                          </td>
                          <td className="py-3 pr-4">
                            {formatCurrencyNoCents(item.valor_total)}
                          </td>
                          <td className="py-3 pr-4">
                            {formatDateDisplayDashShort(item.data_pagamento)}
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
  const [adminTab, setAdminTab] = useState("resumo");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [enquetesOpen, setEnquetesOpen] = useState(false);
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
  const [despesasRows, setDespesasRows] = useState([]);
  const [despesasLoading, setDespesasLoading] = useState(false);
  const [despesasError, setDespesasError] = useState("");
  const [despesasFilterMonth, setDespesasFilterMonth] = useState("");
  const [despesasOpen, setDespesasOpen] = useState(false);
  const [despesasForm, setDespesasForm] = useState({
    data_despesa: "",
    valor: "",
    beneficiario: "",
    descricao: "",
    numero_nota: "",
    chave_nfe: ""
  });
  const [despesasEditing, setDespesasEditing] = useState(null);
  const [despesasFiles, setDespesasFiles] = useState([]);
  const [despesasExistingAnexos, setDespesasExistingAnexos] = useState([]);
  const [despesasRemoveAnexos, setDespesasRemoveAnexos] = useState([]);
  const [despesasMonthOpen, setDespesasMonthOpen] = useState(false);
  const [despesasMonthKey, setDespesasMonthKey] = useState("");
  const [despesasMonthRows, setDespesasMonthRows] = useState([]);
  const [despesasImportOpen, setDespesasImportOpen] = useState(false);
  const [despesasImportRows, setDespesasImportRows] = useState([]);
  const [despesasImportLoading, setDespesasImportLoading] = useState(false);
  const [despesasImportError, setDespesasImportError] = useState("");
  const [despesasImportFileName, setDespesasImportFileName] = useState("");
  const [despesasImportResult, setDespesasImportResult] = useState(null);
  const [resumoMonthKey, setResumoMonthKey] = useState("");
  const [resumoReceitasRows, setResumoReceitasRows] = useState([]);
  const [resumoDespesasRows, setResumoDespesasRows] = useState([]);
  const [resumoMonthLoading, setResumoMonthLoading] = useState(false);
  const [resumoMonthError, setResumoMonthError] = useState("");
  const [resumoExpanded, setResumoExpanded] = useState(false);
  const [creditosRows, setCreditosRows] = useState([]);
  const [creditosLoading, setCreditosLoading] = useState(false);
  const [creditosError, setCreditosError] = useState("");
  const [creditosImportOpen, setCreditosImportOpen] = useState(false);
  const [creditosImportRows, setCreditosImportRows] = useState([]);
  const [creditosImportLoading, setCreditosImportLoading] = useState(false);
  const [creditosImportError, setCreditosImportError] = useState("");
  const [creditosImportFileName, setCreditosImportFileName] = useState("");
  const [creditosImportResult, setCreditosImportResult] = useState(null);
  const [creditosMonthOpen, setCreditosMonthOpen] = useState(false);
  const [creditosMonthKey, setCreditosMonthKey] = useState("");
  const [creditosMonthRows, setCreditosMonthRows] = useState([]);
  const [resumoMensal, setResumoMensal] = useState([]);
  const [resumoLoading, setResumoLoading] = useState(false);
  const [balanceteBusyMonth, setBalanceteBusyMonth] = useState("");
  const [balanceteError, setBalanceteError] = useState("");
  const [associadosSort, setAssociadosSort] = useState("total_desc");
  const associadosMap = useMemo(() => {
    const map = {};
    rows.forEach((item) => {
      map[item.idinscritos] = item.nome;
    });
    return map;
  }, [rows]);

  const filteredSearch = useMemo(() => search.trim(), [search]);
  const despesasSummary = useMemo(() => {
    const map = new Map();
    despesasRows.forEach((row) => {
      const key = getDespesaMonthKey(row);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          key,
          count: 0,
          total: 0,
          max: 0,
          maxBeneficiario: ""
        });
      }
      const entry = map.get(key);
      const valorNum = Number(row.valor || 0);
      entry.count += 1;
      entry.total += valorNum;
      if (valorNum > entry.max) {
        entry.max = valorNum;
        entry.maxBeneficiario = row.beneficiario || "";
      }
    });
    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        avg: entry.count ? entry.total / entry.count : 0
      }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [despesasRows]);
  const despesasTotal = useMemo(
    () => despesasRows.reduce((sum, row) => sum + Number(row.valor || 0), 0),
    [despesasRows]
  );
  const despesasRecentes = useMemo(() => despesasRows, [despesasRows]);
  const resumoDisplayCount = resumoExpanded ? 12 : 4;
  const resumoCards = useMemo(
    () => resumoMensal.slice(0, resumoDisplayCount),
    [resumoMensal, resumoDisplayCount]
  );
  const resumoSaldoBase = useMemo(() => {
    return resumoMensal
      .map((item) => ({
        mes: item.mes,
        saldo: Number(item.creditos_total || 0) - Number(item.despesas_total || 0)
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }, [resumoMensal]);
  const associadosOrdenados = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const totalDiff = Number(b.total_pago || 0) - Number(a.total_pago || 0);
      if (totalDiff !== 0) {
        return associadosSort === "total_desc" ? totalDiff : -totalDiff;
      }
      return String(a.nome || "").localeCompare(String(b.nome || ""));
    });
    return list;
  }, [rows, associadosSort]);

  useEffect(() => {
    if (adminTab !== "despesas") return;
    loadDespesas(despesasFilterMonth);
  }, [adminTab, token, despesasFilterMonth]);

  useEffect(() => {
    if (adminTab !== "receitas") return;
    loadCreditos();
  }, [adminTab, token]);

  useEffect(() => {
    if (!resumoMonthKey) {
      setResumoMonthLoading(false);
      setResumoMonthError("");
      return;
    }
    loadResumoMonth(resumoMonthKey);
  }, [resumoMonthKey, token]);

  useEffect(() => {
    loadResumoMensal();
  }, [token]);

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

  async function loadDespesas(month) {
    setDespesasLoading(true);
    setDespesasError("");
    try {
      const query = month ? `?month=${month}` : "";
      const response = await apiFetch(`/api/despesas${query}`, {}, token);
      if (!response.ok) {
        throw new Error("Falha ao carregar");
      }
      const data = await response.json();
      setDespesasRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setDespesasError("Nao foi possivel carregar as despesas.");
    } finally {
      setDespesasLoading(false);
    }
  }

  async function loadCreditos(month) {
    setCreditosLoading(true);
    setCreditosError("");
    try {
      const query = month ? `?month=${month}` : "";
      const response = await apiFetch(`/api/creditos${query}`, {}, token);
      if (!response.ok) {
        throw new Error("Falha ao carregar");
      }
      const data = await response.json();
      if (month) {
        setCreditosMonthRows(Array.isArray(data) ? data : []);
      } else {
        setCreditosRows(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setCreditosError("Nao foi possivel carregar os creditos.");
    } finally {
      setCreditosLoading(false);
    }
  }

  async function loadResumoMensal() {
    setResumoLoading(true);
    try {
      const response = await apiFetch("/api/resumo-mensal", {}, token);
      if (!response.ok) {
        throw new Error("Falha ao carregar");
      }
      const data = await response.json();
      setResumoMensal(Array.isArray(data) ? data : []);
    } catch (err) {
      setResumoMensal([]);
    } finally {
      setResumoLoading(false);
    }
  }

  async function loadResumoMonth(key) {
    if (!key) return;
    setResumoMonthLoading(true);
    setResumoMonthError("");
    setResumoReceitasRows([]);
    setResumoDespesasRows([]);
    try {
      const [creditosResponse, despesasResponse] = await Promise.all([
        apiFetch(`/api/creditos?month=${key}`, {}, token),
        apiFetch(`/api/despesas?month=${key}`, {}, token)
      ]);
      if (!creditosResponse.ok || !despesasResponse.ok) {
        throw new Error("Falha ao carregar o resumo do mes.");
      }
      const [creditosData, despesasData] = await Promise.all([
        creditosResponse.json(),
        despesasResponse.json()
      ]);
      setResumoReceitasRows(Array.isArray(creditosData) ? creditosData : []);
      setResumoDespesasRows(Array.isArray(despesasData) ? despesasData : []);
    } catch (err) {
      setResumoMonthError("Nao foi possivel carregar o resumo do mes.");
    } finally {
      setResumoMonthLoading(false);
    }
  }

  function getSaldoInicial(monthKey) {
    if (!monthKey) return 0;
    return resumoSaldoBase.reduce((sum, item) => {
      if (!item.mes || item.mes >= monthKey) return sum;
      return sum + item.saldo;
    }, 0);
  }

  async function handleBalancete(monthKey) {
    if (!monthKey) return;
    setBalanceteError("");
    setBalanceteBusyMonth(monthKey);
    try {
      const [creditosResponse, despesasResponse] = await Promise.all([
        apiFetch(`/api/creditos?month=${monthKey}`, {}, token),
        apiFetch(`/api/despesas?month=${monthKey}`, {}, token)
      ]);
      if (!creditosResponse.ok || !despesasResponse.ok) {
        throw new Error("Falha ao carregar dados do balancete.");
      }
      const [creditosData, despesasData] = await Promise.all([
        creditosResponse.json(),
        despesasResponse.json()
      ]);
      const openingBalance = getSaldoInicial(monthKey);
      const pdfBlob = buildBalancetePdf({
        mesKey: monthKey,
        mesLabel: formatMonthYear(monthKey),
        openingBalance,
        creditosRows: Array.isArray(creditosData) ? creditosData : [],
        despesasRows: Array.isArray(despesasData) ? despesasData : []
      });
      const mergedBlob = await mergeBalanceteAnexos({
        baseBlob: pdfBlob,
        despesasRows: Array.isArray(despesasData) ? despesasData : [],
        mesLabel: formatMonthYear(monthKey)
      });
      const url = URL.createObjectURL(mergedBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `balancete-${monthKey}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setBalanceteError("Nao foi possivel gerar o balancete.");
    } finally {
      setBalanceteBusyMonth("");
    }
  }

  function openResumoMonth(key) {
    if (resumoMonthKey === key) {
      setResumoMonthKey("");
      setResumoReceitasRows([]);
      setResumoDespesasRows([]);
      return;
    }
    setResumoMonthKey(key);
  }

  function openDespesaModal(row = null) {
    if (row) {
      const dateValue = row.data_despesa ? new Date(row.data_despesa) : new Date();
      const safeDate = Number.isNaN(dateValue.getTime()) ? new Date() : dateValue;
      setDespesasForm({
        data_despesa: formatDateInput(safeDate),
        valor: row.valor,
        beneficiario: row.beneficiario || "",
        descricao: row.descricao || "",
        numero_nota: row.numero_nota || "",
        chave_nfe: row.chave_nfe || ""
      });
      setDespesasEditing(row);
      setDespesasExistingAnexos(Array.isArray(row.anexos) ? row.anexos : []);
      setDespesasRemoveAnexos([]);
      setDespesasFiles([]);
    } else {
      setDespesasForm({
        data_despesa: formatDateInput(new Date()),
        valor: "",
        beneficiario: "",
        descricao: "",
        numero_nota: "",
        chave_nfe: ""
      });
      setDespesasEditing(null);
      setDespesasExistingAnexos([]);
      setDespesasRemoveAnexos([]);
      setDespesasFiles([]);
    }
    setDespesasError("");
    setDespesasOpen(true);
  }

  function closeDespesaModal() {
    setDespesasOpen(false);
    setDespesasEditing(null);
    setDespesasExistingAnexos([]);
    setDespesasRemoveAnexos([]);
    setDespesasFiles([]);
  }

  function updateDespesaField(field, value) {
    setDespesasForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleAddDespesaAnexos(event) {
    const incoming = Array.from(event.target.files || []);
    event.target.value = "";
    if (!incoming.length) return;
    const currentCount = despesasExistingAnexos.length + despesasFiles.length;
    const remaining = 4 - currentCount;
    if (remaining <= 0) {
      setDespesasError("Maximo de 4 anexos por despesa.");
      return;
    }
    const nextFiles = incoming.slice(0, remaining);
    if (incoming.length > remaining) {
      setDespesasError("Maximo de 4 anexos por despesa.");
    }
    setDespesasFiles((prev) => [...prev, ...nextFiles]);
  }

  function handleRemoveNewDespesaAnexo(index) {
    setDespesasFiles((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleRemoveExistingDespesaAnexo(id) {
    setDespesasExistingAnexos((prev) => prev.filter((item) => item.id !== id));
    setDespesasRemoveAnexos((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  async function handleSaveDespesa() {
    const valorNum = Number(despesasForm.valor);
    if (!despesasForm.data_despesa) {
      setDespesasError("Informe a data da despesa.");
      return;
    }
    if (!despesasForm.beneficiario.trim()) {
      setDespesasError("Informe o beneficiario.");
      return;
    }
    if (!Number.isFinite(valorNum) || valorNum < 0) {
      setDespesasError("Informe um valor valido.");
      return;
    }
    if (despesasExistingAnexos.length + despesasFiles.length > 4) {
      setDespesasError("Maximo de 4 anexos por despesa.");
      return;
    }
    setDespesasLoading(true);
    setDespesasError("");
    try {
      const formData = new FormData();
      formData.append("data_despesa", despesasForm.data_despesa);
      formData.append("valor", String(valorNum));
      formData.append("beneficiario", despesasForm.beneficiario);
      formData.append("descricao", despesasForm.descricao || "");
      formData.append("numero_nota", despesasForm.numero_nota || "");
      formData.append("chave_nfe", despesasForm.chave_nfe || "");
      if (despesasRemoveAnexos.length) {
        formData.append("removeAnexos", JSON.stringify(despesasRemoveAnexos));
      }
      despesasFiles.forEach((file) => formData.append("anexos", file));
      const response = despesasEditing
        ? await apiUpload(
            `/api/despesas/${despesasEditing.iddespesa}`,
            formData,
            token,
            "PUT"
          )
        : await apiUpload("/api/despesas", formData, token);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || (despesasEditing ? "Falha ao atualizar despesa" : "Falha ao cadastrar despesa")
        );
      }
      await loadDespesas();
      closeDespesaModal();
    } catch (err) {
      setDespesasError(
        err.message ||
          (despesasEditing
            ? "Nao foi possivel atualizar a despesa."
            : "Nao foi possivel cadastrar a despesa.")
      );
    } finally {
      setDespesasLoading(false);
    }
  }

  async function handleParseExtrato(file) {
    if (!file) return;
    setDespesasImportLoading(true);
    setDespesasImportError("");
    setDespesasImportRows([]);
    setDespesasImportFileName(file.name);
    setDespesasImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiUpload("/api/despesas/import", formData, token);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao processar o extrato");
      }
      const data = await response.json();
      setDespesasImportRows(data.rows || []);
    } catch (err) {
      setDespesasImportError(err.message || "Nao foi possivel ler o extrato.");
    } finally {
      setDespesasImportLoading(false);
    }
  }

  async function handleImportExtrato() {
    if (!despesasImportRows.length) return;
    setDespesasImportLoading(true);
    setDespesasImportError("");
    try {
      const response = await apiFetch(
        "/api/despesas/bulk",
        {
          method: "POST",
          body: JSON.stringify({ rows: despesasImportRows })
        },
        token
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao importar despesas");
      }
      const data = await response.json();
      setDespesasImportResult({
        inserted: data.inserted ?? 0,
        skipped: data.skipped ?? 0
      });
      await loadDespesas();
      await loadResumoMensal();
    } catch (err) {
      setDespesasImportError(err.message || "Nao foi possivel importar as despesas.");
    } finally {
      setDespesasImportLoading(false);
    }
  }

  async function handleParseCreditos(file) {
    if (!file) return;
    setCreditosImportLoading(true);
    setCreditosImportError("");
    setCreditosImportRows([]);
    setCreditosImportFileName(file.name);
    setCreditosImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiUpload("/api/creditos/import", formData, token);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao processar o extrato");
      }
      const data = await response.json();
      const rows = data.rows || [];
      setCreditosImportRows(rows);
      const firstMonth = rows[0]?.data_credito?.slice(0, 7) || "";
      if (firstMonth) {
        setCreditosMonthKey(firstMonth);
      }
      await loadResumoMensal();
    } catch (err) {
      setCreditosImportError(err.message || "Nao foi possivel ler o extrato.");
    } finally {
      setCreditosImportLoading(false);
    }
  }

  async function handleSelectCreditoMatch(idcredito, idinscrito) {
    if (!idinscrito) return;
    try {
      const response = await apiFetch(
        `/api/creditos/${idcredito}/match`,
        {
          method: "POST",
          body: JSON.stringify({ idinscrito: Number(idinscrito) })
        },
        token
      );
      if (!response.ok) {
        throw new Error("Falha ao atualizar");
      }
      const data = await response.json().catch(() => ({}));
      const matchedIds = Array.isArray(data.matched_ids)
        ? data.matched_ids.map((item) => Number(item))
        : [Number(idcredito)];
      const resolvedName = (row) =>
        row.candidatos?.find(
          (cand) => String(cand.idinscrito) === String(idinscrito)
        )?.nome || row.associado_nome || "Selecionado";
      setCreditosImportRows((prev) =>
        prev.map((row) =>
          matchedIds.includes(Number(row.idcredito))
            ? {
                ...row,
                match_status: "matched",
                match_origin: "auto",
                associado_nome: resolvedName(row)
              }
            : row
        )
      );
      setCreditosMonthRows((prev) =>
        prev.map((row) =>
          matchedIds.includes(Number(row.idcredito))
            ? {
                ...row,
                match_status: "matched",
                match_origin: "auto",
                associado_nome: resolvedName(row)
              }
            : row
        )
      );
      setCreditosRows((prev) =>
        prev.map((row) =>
          matchedIds.includes(Number(row.idcredito))
            ? {
                ...row,
                match_status: "matched",
                match_origin: "auto",
                associado_nome: resolvedName(row)
              }
            : row
        )
      );
    } catch (err) {
      setCreditosImportError("Nao foi possivel selecionar o associado.");
    }
  }

  async function handleLinkCredito(idcredito, idinscrito) {
    if (!idinscrito) return;
    try {
      const response = await apiFetch(
        `/api/creditos/${idcredito}/link`,
        {
          method: "POST",
          body: JSON.stringify({ idinscrito: Number(idinscrito) })
        },
        token
      );
      if (!response.ok) {
        throw new Error("Falha ao vincular");
      }
      const data = await response.json().catch(() => ({}));
      const matchedIds = Array.isArray(data.matched_ids)
        ? data.matched_ids.map((item) => Number(item))
        : [Number(idcredito)];
      const associadoNome = associadosMap[idinscrito] || "Selecionado";
      const updateRow = (row) =>
        matchedIds.includes(Number(row.idcredito))
          ? {
              ...row,
              match_status: "matched",
              match_origin: "manual",
              associado_nome: associadoNome
            }
          : row;
      setCreditosImportRows((prev) => prev.map(updateRow));
      setCreditosMonthRows((prev) => prev.map(updateRow));
      setCreditosRows((prev) => prev.map(updateRow));
    } catch (err) {
      setCreditosError("Nao foi possivel vincular o credito.");
    }
  }

  async function handleUnlinkCredito(idcredito) {
    if (!idcredito) return;
    try {
      const response = await apiFetch(
        `/api/creditos/${idcredito}/unlink`,
        { method: "POST" },
        token
      );
      if (!response.ok) {
        throw new Error("Falha ao remover vinculo");
      }
      const data = await response.json().catch(() => ({}));
      const matchedIds = Array.isArray(data.matched_ids)
        ? data.matched_ids.map((item) => Number(item))
        : [Number(idcredito)];
      const updateRow = (row) =>
        matchedIds.includes(Number(row.idcredito))
          ? {
              ...row,
              match_status: "unmatched",
              match_origin: "auto",
              idinscrito: null,
              associado_nome: null
            }
          : row;
      setCreditosImportRows((prev) => prev.map(updateRow));
      setCreditosMonthRows((prev) => prev.map(updateRow));
      setCreditosRows((prev) => prev.map(updateRow));
    } catch (err) {
      setCreditosError("Nao foi possivel remover o vinculo.");
    }
  }

  async function handleImportMensalidades(month) {
    if (!month) {
      setCreditosImportError("Selecione o mes para importar.");
      return;
    }
    setCreditosImportLoading(true);
    setCreditosImportError("");
    try {
      const response = await apiFetch(
        "/api/creditos/importar",
        {
          method: "POST",
          body: JSON.stringify({ month })
        },
        token
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao importar mensalidades");
      }
      const data = await response.json();
      setCreditosImportResult({
        inserted: data.inserted ?? 0,
        skipped: data.skipped ?? 0
      });
      await loadResumoMensal();
      if (month) {
        await loadCreditos(month);
      } else {
        await loadCreditos();
      }
    } catch (err) {
      setCreditosImportError(err.message || "Nao foi possivel importar.");
    } finally {
      setCreditosImportLoading(false);
    }
  }

  function openMonthDetails(key) {
    setDespesasMonthKey(key);
    setDespesasMonthRows([]);
    setDespesasMonthOpen(true);
    loadDespesasMonth(key);
  }

  async function loadDespesasMonth(key) {
    if (!key) return;
    try {
      const response = await apiFetch(`/api/despesas?month=${key}`, {}, token);
      if (!response.ok) {
        throw new Error("Falha ao carregar");
      }
      const data = await response.json();
      setDespesasMonthRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setDespesasMonthRows([]);
    }
  }

  function openCreditosMonth(key) {
    setCreditosMonthKey(key);
    setCreditosMonthRows([]);
    setCreditosMonthOpen(true);
    loadCreditos(key);
  }

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

  async function handleAdd(form) {
    try {
      const response = await apiFetch(
        "/api/inscritos",
        {
          method: "POST",
          body: JSON.stringify(form)
        },
        token
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao adicionar");
      }
      const data = await response.json();
      setRows((prev) => [
        {
          ...data,
          total_pago: 0,
          total_doacao: 0
        },
        ...prev
      ]);
      setAdding(false);
    } catch (err) {
      setError(err.message || "Nao foi possivel adicionar o associado.");
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
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Visao geral
              </p>
              <h2 className="mt-2 text-xl font-display text-slate-900">
                Resumo mensal
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {resumoMensal.length > 4 ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  onClick={() => setResumoExpanded((prev) => !prev)}
                >
                  {resumoExpanded ? "Mostrar menos" : "Mostrar mais 8 meses"}
                </button>
              ) : null}
              {resumoLoading ? (
                <span className="text-xs text-slate-400">Atualizando...</span>
              ) : null}
            </div>
          </div>
          {balanceteError ? (
            <p className="mt-3 text-sm text-rose-600">{balanceteError}</p>
          ) : null}
          {resumoCards.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Nenhum resumo disponivel ainda.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {resumoCards.map((item) => (
                <div
                  key={item.mes}
                  className={`cursor-pointer rounded-2xl border border-slate-100 bg-white p-5 shadow-card transition hover:border-blue-100 hover:shadow-lg ${
                    resumoMonthKey === item.mes
                      ? "border-blue-200 ring-1 ring-blue-100"
                      : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openResumoMonth(item.mes)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openResumoMonth(item.mes);
                    }
                  }}
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                    <span>{formatMonthYear(item.mes)}</span>
                    {resumoMonthKey === item.mes ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Receitas</span>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(item.creditos_total)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Despesas</span>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(item.despesas_total)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Creditos: {item.creditos_count}</span>
                      <span>Despesas: {item.despesas_count}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-nowrap gap-2">
                    <button
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      onClick={(event) => {
                        event.stopPropagation();
                        openCreditosMonth(item.mes);
                      }}
                      title="Receitas"
                      aria-label="Receitas"
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                      <span className="sm:hidden">Receitas</span>
                    </button>
                    <button
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      onClick={(event) => {
                        event.stopPropagation();
                        openMonthDetails(item.mes);
                      }}
                      title="Despesas"
                      aria-label="Despesas"
                    >
                      <ArrowDownCircle className="h-4 w-4" />
                      <span className="sm:hidden">Despesas</span>
                    </button>
                    <button
                      className={`flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 ${
                        balanceteBusyMonth === item.mes
                          ? "cursor-not-allowed opacity-60"
                          : ""
                      }`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (balanceteBusyMonth === item.mes) return;
                        handleBalancete(item.mes);
                      }}
                      title="Balancete"
                      aria-label="Balancete"
                    >
                      {balanceteBusyMonth === item.mes ? (
                        <span className="font-semibold">...</span>
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      <span className="sm:hidden">Balancete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Administrativo
            </p>
            <h2 className="mt-2 text-2xl font-display text-slate-900">
              Painel da associacao
            </h2>
          </div>
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {[
                { id: "resumo", label: "Resumo" },
                { id: "associados", label: "Associados" },
                { id: "despesas", label: "Despesas" },
                { id: "receitas", label: "Receitas" }
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-md px-3 py-2 ${
                    adminTab === item.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  onClick={() => setAdminTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {adminTab === "despesas" ? (
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                  onClick={() => setDespesasImportOpen(true)}
                >
                  Importar extrato
                </button>
                <button
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  onClick={() => openDespesaModal()}
                >
                  Nova despesa
                </button>
              </div>
            ) : adminTab === "receitas" ? (
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                  onClick={() => setCreditosImportOpen(true)}
                >
                  Importar extrato
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {resumoMonthKey ? (
          <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Resumo do mes
                </p>
                <h3 className="mt-2 text-lg font-display text-slate-900">
                  {formatMonthYear(resumoMonthKey)}
                </h3>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                onClick={() => setResumoMonthKey("")}
              >
                Fechar
              </button>
            </div>

            {resumoMonthError ? (
              <p className="mt-3 text-sm text-rose-600">{resumoMonthError}</p>
            ) : resumoMonthLoading ? (
              <p className="mt-3 text-sm text-slate-500">Carregando...</p>
            ) : (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-700">
                      Receitas
                    </h4>
                    <span className="text-xs text-slate-400">
                      {resumoReceitasRows.length} registros
                    </span>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left text-xs text-slate-600">
                      <thead className="uppercase text-slate-400">
                        <tr>
                          <th className="py-2 pr-3">Data</th>
                          <th className="py-2 pr-3">Nome</th>
                          <th className="py-2 pr-3 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {resumoReceitasRows.length === 0 ? (
                          <tr>
                            <td className="py-3 text-slate-400" colSpan={3}>
                              Nenhuma receita encontrada.
                            </td>
                          </tr>
                        ) : (
                          resumoReceitasRows.map((row) => (
                            <tr key={row.idcredito}>
                              <td className="py-2 pr-3">
                                {formatDateDisplay(row.data_credito)}
                              </td>
                              <td className="py-2 pr-3">
                                {row.pagador_nome || row.pagador_documento || "-"}
                              </td>
                              <td className="py-2 pr-3 text-right font-semibold text-slate-700">
                                {formatCurrency(row.valor)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="py-2 pr-3 text-slate-500" colSpan={2}>
                            Total
                          </td>
                          <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                            {formatCurrency(
                              resumoReceitasRows.reduce(
                                (sum, row) => sum + Number(row.valor || 0),
                                0
                              )
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-700">
                      Despesas
                    </h4>
                    <span className="text-xs text-slate-400">
                      {resumoDespesasRows.length} registros
                    </span>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left text-xs text-slate-600">
                      <thead className="uppercase text-slate-400">
                        <tr>
                          <th className="py-2 pr-3">Data</th>
                          <th className="py-2 pr-3">Descricao</th>
                          <th className="py-2 pr-3 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {resumoDespesasRows.length === 0 ? (
                          <tr>
                            <td className="py-3 text-slate-400" colSpan={3}>
                              Nenhuma despesa encontrada.
                            </td>
                          </tr>
                        ) : (
                          resumoDespesasRows.map((row) => (
                            <tr key={row.iddespesa}>
                              <td className="py-2 pr-3">
                                {formatDateDisplay(row.data_despesa)}
                              </td>
                              <td className="py-2 pr-3">
                                {row.descricao || "-"}
                              </td>
                              <td className="py-2 pr-3 text-right font-semibold text-slate-700">
                                {formatCurrency(row.valor)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="py-2 pr-3 text-slate-500" colSpan={2}>
                            Total
                          </td>
                          <td className="py-2 pr-3 text-right font-semibold text-slate-900">
                            {formatCurrency(
                              resumoDespesasRows.reduce(
                                (sum, row) => sum + Number(row.valor || 0),
                                0
                              )
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {adminTab === "associados" ? (
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
                <button
                  className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                  onClick={() => setEnquetesOpen(true)}
                >
                  Enquetes
                </button>
                <button
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  onClick={() => setAdding(true)}
                >
                  Novo associado
                </button>
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
                    <th className="py-3 pr-4">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600"
                        onClick={() =>
                          setAssociadosSort((prev) =>
                            prev === "total_desc" ? "total_asc" : "total_desc"
                          )
                        }
                      >
                        Total pago
                        {associadosSort === "total_desc" ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronUp className="h-3 w-3" />
                        )}
                      </button>
                    </th>
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
                  ) : associadosOrdenados.length === 0 ? (
                    <tr>
                      <td className="py-4 text-slate-500" colSpan={7}>
                        Nenhum inscrito encontrado.
                      </td>
                    </tr>
                  ) : (
                    associadosOrdenados.map((row) => (
                      <tr key={row.idinscritos} className="text-slate-700">
                        <td
                          className={`py-3 pr-4 font-medium ${
                            statusFilter === "inadimplente"
                              ? Number(row.total_pago_12m || 0) >= 360
                                ? "text-blue-600"
                                : "text-rose-600"
                              : "text-slate-900"
                          }`}
                        >
                          {row.nome}
                        </td>
                        <td className="py-3 pr-4">{row.cpf}</td>
                        <td className="py-3 pr-4">{row.rua}</td>
                        <td className="py-3 pr-4">{row.numero}</td>
                        <td className="py-3 pr-4">{row.telefone}</td>
                        <td
                          className={`py-3 pr-4 ${
                            statusFilter === "inadimplente"
                              ? Number(row.total_pago_12m || 0) >= 360
                                ? "text-blue-600"
                                : "text-rose-600"
                              : "text-slate-700"
                          }`}
                        >
                          {formatCurrency(row.total_pago)}
                        </td>
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
        ) : adminTab === "despesas" ? (
          <div className="relative flex flex-col gap-6 overflow-hidden rounded-2xl bg-white p-6 shadow-card">
            <div className="pointer-events-none absolute inset-x-0 -top-16 h-32 bg-gradient-to-r from-blue-100/80 via-sky-50 to-cyan-100/60" />
            <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-display text-slate-900">Despesas</h2>
                <p className="mt-2 text-xs text-slate-500">
                  Total geral:{" "}
                  <span className="font-semibold text-slate-700">
                    {formatCurrency(despesasTotal)}
                  </span>{" "}
                  - Registros:{" "}
                  <span className="font-semibold text-slate-700">
                    {despesasRows.length}
                  </span>
                </p>
              </div>
            </div>

            {despesasError ? (
              <p className="text-sm text-rose-600">{despesasError}</p>
            ) : null}

            {despesasLoading ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : despesasRows.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhuma despesa cadastrada ainda.
              </p>
            ) : null}

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">
                  Despesas do mes
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="month"
                    value={despesasFilterMonth}
                    onChange={(event) => setDespesasFilterMonth(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <button
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500 hover:text-blue-600"
                    onClick={() => loadDespesas(despesasFilterMonth)}
                  >
                    Atualizar
                  </button>
                </div>
              </div>
              <div className="mt-3 max-h-[420px] overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-3 pr-4">Data</th>
                      <th className="py-3 pr-4">Beneficiario</th>
                      <th className="py-3 pr-4">Descricao</th>
                      <th className="py-3 pr-4 text-right">Anexos</th>
                      <th className="py-3 pr-4 text-right">Valor</th>
                      <th className="py-3 pr-4 text-right">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {despesasRecentes.length === 0 ? (
                      <tr>
                        <td className="py-4 text-slate-500" colSpan={6}>
                          Nenhuma despesa encontrada.
                        </td>
                      </tr>
                    ) : (
                      despesasRecentes.map((row) => (
                        <tr key={row.iddespesa} className="text-slate-700">
                          <td className="py-3 pr-4">
                            {formatDateDisplay(row.data_despesa)}
                          </td>
                          <td className="py-3 pr-4 font-medium text-slate-900">
                            {row.beneficiario}
                          </td>
                          <td className="py-3 pr-4 text-slate-500">
                            {row.descricao || "-"}
                          </td>
                          <td className="py-3 pr-4 text-right text-sm text-slate-500">
                            {(() => {
                              const anexos = Array.isArray(row.anexos) ? row.anexos : [];
                              if (!anexos.length) return "-";
                              const visible = anexos.slice(0, 2);
                              return (
                                <div className="flex items-center justify-end gap-2">
                                  {visible.map((anexo) => {
                                    const anexoUrl = anexo.url?.startsWith("http")
                                      ? anexo.url
                                      : `${API_BASE}${anexo.url}`;
                                    const isImage = anexo.mimeType?.startsWith("image/");
                                    return (
                                      <a
                                        key={anexo.id}
                                        href={anexoUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50 text-xs text-slate-600"
                                      >
                                        {isImage ? (
                                          <img
                                            src={anexoUrl}
                                            alt={anexo.nome}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          "ARQ"
                                        )}
                                      </a>
                                    );
                                  })}
                                  {anexos.length > 2 ? (
                                    <span className="text-xs text-slate-400">
                                      +{anexos.length - 2}
                                    </span>
                                  ) : null}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3 pr-4 text-right font-semibold text-slate-700">
                            {formatCurrency(row.valor)}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <button
                              type="button"
                              onClick={() => openDespesaModal(row)}
                              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                              Editar
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
        ) : adminTab === "receitas" ? (
          <div className="relative flex flex-col gap-6 overflow-hidden rounded-2xl bg-white p-6 shadow-card">
            <div className="pointer-events-none absolute inset-x-0 -top-16 h-32 bg-gradient-to-r from-blue-100/80 via-sky-50 to-cyan-100/60" />
            <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-display text-slate-900">Receitas</h2>
                <p className="mt-2 text-xs text-slate-500">
                  Creditos analisados:{" "}
                  <span className="font-semibold text-slate-700">
                    {creditosRows.length}
                  </span>
                </p>
              </div>
              <button
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() =>
                  handleImportMensalidades(
                    creditosMonthKey || resumoCards?.[0]?.mes || ""
                  )
                }
                disabled={creditosImportLoading}
              >
                Importar mensalidades do mes
              </button>
            </div>

            {creditosError ? (
              <p className="text-sm text-rose-600">{creditosError}</p>
            ) : null}

            {creditosLoading ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : creditosRows.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhum credito analisado ainda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-3 pr-4">Data</th>
                      <th className="py-3 pr-4">Pagador</th>
                      <th className="py-3 pr-4">Descricao</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {creditosRows.map((row) => (
                      <tr key={row.idcredito} className="text-slate-700">
                        <td className="py-3 pr-4">
                          {formatDateDisplay(row.data_credito)}
                        </td>
                        <td className="py-3 pr-4 font-medium text-slate-900">
                          {row.pagador_nome || row.pagador_documento || "-"}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">
                          {row.descricao || "-"}
                        </td>
                        <td className="py-3 pr-4">
                          {row.match_status === "matched" ||
                          row.match_status === "importado" ? (
                            <span className="text-emerald-600">Encontrado</span>
                          ) : row.match_status === "ambiguous" ? (
                            <span className="text-amber-600">Ambiguo</span>
                          ) : (
                            <span className="text-rose-600">Nao encontrado</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold text-slate-700">
                          {formatCurrency(row.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </main>

      <EditModal
        open={Boolean(editing)}
        value={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
      <AddAssociadoModal
        open={adding}
        onClose={() => setAdding(false)}
        onSave={handleAdd}
      />
      <AdminEnquetesModal
        open={enquetesOpen}
        onClose={() => setEnquetesOpen(false)}
        token={token}
      />
      <DespesaModal
        open={despesasOpen}
        onClose={closeDespesaModal}
        form={despesasForm}
        onChange={updateDespesaField}
        onSave={handleSaveDespesa}
        existingAnexos={despesasExistingAnexos}
        newAnexos={despesasFiles}
        onAddAnexos={handleAddDespesaAnexos}
        onRemoveNewAnexo={handleRemoveNewDespesaAnexo}
        onRemoveExistingAnexo={handleRemoveExistingDespesaAnexo}
        isEdit={Boolean(despesasEditing)}
      />
      <DespesasMonthModal
        open={despesasMonthOpen}
        onClose={() => setDespesasMonthOpen(false)}
        monthKey={despesasMonthKey}
        rows={despesasMonthRows}
      />
      <ReceitasMonthModal
        open={creditosMonthOpen}
        onClose={() => setCreditosMonthOpen(false)}
        monthKey={creditosMonthKey}
        rows={creditosMonthRows}
        onSelect={handleSelectCreditoMatch}
        onLink={handleLinkCredito}
        onUnlink={handleUnlinkCredito}
        associados={rows}
      />
      <DespesasImportModal
        open={despesasImportOpen}
        onClose={() => setDespesasImportOpen(false)}
        onParse={handleParseExtrato}
        onImport={handleImportExtrato}
        loading={despesasImportLoading}
        error={despesasImportError}
        rows={despesasImportRows}
        fileName={despesasImportFileName}
        result={despesasImportResult}
      />
      <ReceitasImportModal
        open={creditosImportOpen}
        onClose={() => setCreditosImportOpen(false)}
        onParse={handleParseCreditos}
        onImport={() => handleImportMensalidades(creditosMonthKey || resumoCards?.[0]?.mes)}
        onSelectMatch={handleSelectCreditoMatch}
        loading={creditosImportLoading}
        error={creditosImportError}
        rows={creditosImportRows}
        fileName={creditosImportFileName}
        result={creditosImportResult}
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
