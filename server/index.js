import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import { promisify } from "util";
import { execFile } from "child_process";
import multer from "multer";
import pool from "./db.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const execFileAsync = promisify(execFile);
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const adminUser = process.env.ADMIN_USER || "admin";
const adminPass = process.env.ADMIN_PASS || "1234";
const adminToken = process.env.ADMIN_TOKEN || "admin-token";
const userTokenSecret = process.env.USER_TOKEN_SECRET || "user-secret";
const MONTHLY_FEE = Number(process.env.MONTHLY_FEE || 30);
const START_COMPETENCIA = "2025-12-01";

function formatCompetencia(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === adminUser && password === adminPass) {
    res.json({ token: adminToken });
    return;
  }
  res.status(401).json({ error: "Credenciais invalidas" });
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== adminToken) {
    res.status(401).json({ error: "Nao autorizado" });
    return;
  }
  next();
}

function signUserToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", userTokenSecret).update(data).digest("hex");
  return `${data}.${signature}`;
}

function verifyUserToken(token) {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expected = crypto.createHmac("sha256", userTokenSecret).update(data).digest("hex");
  if (signature.length !== expected.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch (err) {
    return null;
  }
}

function requireUserAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const payload = verifyUserToken(token);
  if (!payload?.idinscrito) {
    res.status(401).json({ error: "Nao autorizado" });
    return;
  }
  req.user = payload;
  next();
}

function normalizeCpf(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function createDespesaHash({ data_despesa, valor, beneficiario, descricao }) {
  const normalizedValue = Number(valor).toFixed(2);
  const payload = [
    data_despesa,
    normalizedValue,
    String(beneficiario || "").trim(),
    String(descricao || "")
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function createCreditoHash({ data_credito, valor, pagador_nome, pagador_documento, descricao }) {
  const normalizedValue = Number(valor).toFixed(2);
  const payload = [
    data_credito,
    normalizedValue,
    String(pagador_nome || "").trim(),
    String(pagador_documento || "").trim(),
    String(descricao || "")
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function parseStatementPeriod(text) {
  const match = text.match(/PER[IÍ]ODO:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (!match) return null;
  const [start, end] = match.slice(1);
  return { start, end };
}

function toIsoDate(dateStr, year) {
  const [day, month] = dateStr.split("/");
  return `${year}-${month}-${day}`;
}

function toIsoDateFull(dateStr) {
  const [day, month, year] = dateStr.split("/");
  if (!day || !month || !year) return null;
  return `${year}-${month}-${day}`;
}

function toDecimal(valueStr) {
  return Number(valueStr.replace(/\./g, "").replace(",", "."));
}

function normalizeDescription(value) {
  const cleaned = String(value || "")
    .replace(/\bconfraternizaca\s+o\b/i, "confraternizacao")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

function extractBeneficiaryAndDescription(details, history) {
  const detailLines = details.filter((line) => line && !/^DOC\.:/i.test(line));
  let beneficiary = "";
  let descriptionParts = [];
  const paymentIdx = detailLines.findIndex((line) => /Pagamento Pix/i.test(line));
  if (paymentIdx !== -1) {
    const candidate = detailLines[paymentIdx + 1] || "";
    beneficiary = candidate;
    descriptionParts = detailLines.slice(paymentIdx + 2);
  } else if (detailLines.length) {
    beneficiary = detailLines[0];
    descriptionParts = detailLines.slice(1);
  }
  let description = normalizeDescription(descriptionParts.join(" "));
  if (!description) {
    if (history.toUpperCase().startsWith("DEB PACOTE")) {
      const doc = details.find((line) => line.startsWith("DOC.:")) || "";
      description = normalizeDescription(`Debito pacote servicos ${doc}`);
    } else if (history.toUpperCase().startsWith("DÉB.TIT")) {
      const doc = details.find((line) => line.startsWith("DOC.:")) || "";
      description = normalizeDescription(`Debito titulo compensacao efetiva ${doc}`);
    } else {
      description = "Pagamento Pix";
    }
  }
  if (!beneficiary) {
    beneficiary = "Sicoob";
  }
  return {
    beneficiary: beneficiary.trim(),
    description
  };
}

function parseStatementText(text) {
  const lines = text.split(/\r?\n/);
  const txLineRe = /^(\d{2}\/\d{2})\s+(.+?)\s+([\d.]+,\d{2})([CD])\s*$/;
  const period = parseStatementPeriod(text);
  const year = period?.start?.split("/")?.[2] || String(new Date().getFullYear());
  const transactions = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(txLineRe);
    if (match) {
      const date = match[1];
      const history = match[2].trim();
      const valueStr = match[3];
      const dc = match[4];
      const details = [];
      i += 1;
      while (i < lines.length) {
        const next = lines[i];
        if (txLineRe.test(next)) break;
        if (next.trim().length) details.push(next.trim());
        i += 1;
      }
      transactions.push({
        date,
        history,
        valueStr,
        dc,
        details
      });
      continue;
    }
    i += 1;
  }
  return transactions
    .filter((tx) => tx.dc === "D")
    .map((tx) => {
      const { beneficiary, description } = extractBeneficiaryAndDescription(
        tx.details,
        tx.history
      );
      return {
        data_despesa: toIsoDate(tx.date, year),
        valor: toDecimal(tx.valueStr),
        beneficiario: beneficiary,
        descricao: description
      };
    })
    .filter((row) => row.valor > 0 && row.data_despesa);
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function getMiddleSixDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 6) return digits;
  if (digits.length === 11) return digits.slice(3, 9);
  if (digits.length > 6) {
    const start = Math.floor((digits.length - 6) / 2);
    return digits.slice(start, start + 6);
  }
  return "";
}

function extractPagador(details, history) {
  const detailLines = details.filter((line) => line && !/^DOC\.:/i.test(line));
  const lowerHistory = history.toLowerCase();
  let name = "";
  let document = "";
  let description = "";
  const receivedIdx = detailLines.findIndex((line) => /Recebimento Pix/i.test(line));
  if (receivedIdx !== -1) {
    const candidateName = detailLines[receivedIdx + 1] || "";
    name = candidateName;
    const possibleDoc = detailLines[receivedIdx + 2] || "";
    if (/\d|\*/.test(possibleDoc) && !/Recebimento|Transfer/i.test(possibleDoc)) {
      document = possibleDoc;
    }
    const descStart = receivedIdx + (document ? 3 : 2);
    description = normalizeDescription(detailLines.slice(descStart).join(" "));
  } else {
    const remIdx = detailLines.findIndex((line) => /^REM\.:/i.test(line));
    if (remIdx !== -1) {
      const remLine = detailLines[remIdx].replace(/^REM\.:/i, "").trim();
      name = remLine;
      description = normalizeDescription(detailLines.slice(remIdx + 1).join(" "));
    } else if (detailLines.length) {
      name = detailLines.find((line) => /[A-Za-z]/.test(line)) || "";
      const nameIdx = detailLines.indexOf(name);
      const possibleDoc = detailLines[nameIdx + 1] || "";
      if (/\d|\*/.test(possibleDoc) && !/[A-Za-z]/.test(possibleDoc)) {
        document = possibleDoc;
      }
      description = normalizeDescription(detailLines.slice(nameIdx + 1).join(" "));
    }
  }
  if (!description && lowerHistory.includes("cred")) {
    description = history;
  }
  return {
    pagador_nome: name.trim(),
    pagador_documento: document.trim(),
    descricao: description
  };
}

function parseStatementCredits(text) {
  const lines = text.split(/\r?\n/);
  const txLineRe = /^(\d{2}\/\d{2})\s+(.+?)\s+([\d.]+,\d{2})([CD])\s*$/;
  const period = parseStatementPeriod(text);
  const year = period?.start?.split("/")?.[2] || String(new Date().getFullYear());
  const transactions = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(txLineRe);
    if (match) {
      const date = match[1];
      const history = match[2].trim();
      const valueStr = match[3];
      const dc = match[4];
      const details = [];
      i += 1;
      while (i < lines.length) {
        const next = lines[i];
        if (txLineRe.test(next)) break;
        if (next.trim().length) details.push(next.trim());
        i += 1;
      }
      transactions.push({
        date,
        history,
        valueStr,
        dc,
        details
      });
      continue;
    }
    i += 1;
  }
  return transactions
    .filter((tx) => tx.dc === "C")
    .filter((tx) => !/SALDO|RESUMO|ENCARGOS|TARIFAS|JUROS/i.test(tx.history))
    .map((tx) => {
      const payload = extractPagador(tx.details, tx.history);
      return {
        data_credito: toIsoDate(tx.date, year),
        valor: toDecimal(tx.valueStr),
        ...payload
      };
    })
    .filter((row) => row.valor > 0 && row.data_credito);
}

function computeMatchCandidates(credit, inscritos) {
  const docKey = getMiddleSixDigits(credit.pagador_documento);
  const cpfMatches = docKey
    ? inscritos.filter((item) => item.cpfMiddle && item.cpfMiddle === docKey)
    : [];
  if (cpfMatches.length === 1) {
    return {
      status: "matched",
      idinscrito: cpfMatches[0].idinscritos,
      candidates: []
    };
  }
  if (cpfMatches.length > 1) {
    return {
      status: "ambiguous",
      idinscrito: null,
      candidates: cpfMatches.map((item) => ({
        idinscrito: item.idinscritos,
        nome: item.nome,
        score: 1,
        origem: "cpf"
      }))
    };
  }

  const creditName = normalizeName(credit.pagador_nome);
  if (!creditName) {
    return { status: "unmatched", idinscrito: null, candidates: [] };
  }
  const creditTokens = creditName.split(" ").filter((token) => token.length >= 3);
  const nameMatches = inscritos
    .map((item) => {
      const nameTokens = item.nomeTokens;
      const matchCount = creditTokens.filter((token) => nameTokens.includes(token)).length;
      const score = creditTokens.length ? matchCount / creditTokens.length : 0;
      return {
        idinscrito: item.idinscritos,
        score
      };
    })
    .filter((item) => item.score >= 0.6)
    .sort((a, b) => b.score - a.score);
  if (nameMatches.length === 1) {
    return {
      status: "matched",
      idinscrito: nameMatches[0].idinscrito,
      candidates: []
    };
  }
  if (nameMatches.length > 1) {
    return {
      status: "ambiguous",
      idinscrito: null,
      candidates: nameMatches.slice(0, 5).map((item) => ({
        idinscrito: item.idinscrito,
        nome: inscritos.find((row) => row.idinscritos === item.idinscrito)?.nome,
        score: item.score,
        origem: "nome"
      }))
    };
  }
  return { status: "unmatched", idinscrito: null, candidates: [] };
}

async function fetchEnquetes({ statusList, userId }) {
  const statuses = statusList && statusList.length ? statusList : ["aberta", "encerrada"];
  const [polls] = await pool.query(
    "SELECT idenquete, titulo, descricao, status, created_at FROM enquetes WHERE status IN (?) ORDER BY created_at DESC",
    [statuses]
  );
  if (!polls.length) return [];
  const pollIds = polls.map((poll) => poll.idenquete);
  const [options] = await pool.query(
    "SELECT o.idopcao, o.idenquete, o.texto, COUNT(v.idvoto) AS votos " +
      "FROM enquete_opcoes o " +
      "LEFT JOIN enquete_votos v ON v.idopcao = o.idopcao " +
      "WHERE o.idenquete IN (?) " +
      "GROUP BY o.idopcao " +
      "ORDER BY o.idopcao",
    [pollIds]
  );
  const optionsByPoll = options.reduce((acc, option) => {
    if (!acc[option.idenquete]) acc[option.idenquete] = [];
    acc[option.idenquete].push({
      idopcao: option.idopcao,
      texto: option.texto,
      votos: Number(option.votos || 0)
    });
    return acc;
  }, {});

  let votesByPoll = {};
  if (userId) {
    const [votes] = await pool.query(
      "SELECT idenquete, idopcao FROM enquete_votos WHERE idinscrito = ? AND idenquete IN (?)",
      [userId, pollIds]
    );
    votesByPoll = votes.reduce((acc, vote) => {
      acc[vote.idenquete] = vote.idopcao;
      return acc;
    }, {});
  }

  return polls.map((poll) => ({
    ...poll,
    opcoes: optionsByPoll[poll.idenquete] || [],
    voto_idopcao: votesByPoll[poll.idenquete] || null
  }));
}

app.get("/api/inscritos", requireAuth, async (req, res) => {
  const search = (req.query.search || "").trim();
  const status = (req.query.status || "todos").toLowerCase();
  const like = `%${search}%`;
  try {
    const [totalRows] = await pool.query("SELECT COUNT(*) AS total FROM inscritos");
    const total = totalRows?.[0]?.total || 0;
    const prevMonth = new Date();
    prevMonth.setDate(1);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const competencia = formatCompetencia(prevMonth);
    const applyCompliance = competencia >= START_COMPETENCIA;
    const baseSelect =
      "SELECT i.idinscritos, i.nome, i.cpf, i.rua, i.numero, i.telefone, i.email, i.profissao, " +
      "COALESCE(m.total_pago, 0) AS total_pago, COALESCE(m.total_doacao, 0) AS total_doacao " +
      "FROM inscritos i " +
      "LEFT JOIN (SELECT idinscrito, SUM(valor_total) AS total_pago, SUM(doacao) AS total_doacao FROM mensalidades GROUP BY idinscrito) m " +
      "ON m.idinscrito = i.idinscritos ";
    const whereParts = [];
    const params = [];

    if (search) {
      whereParts.push("(i.nome LIKE ? OR i.cpf LIKE ? OR i.rua LIKE ?)");
      params.push(like, like, like);
    }

    if (status === "inadimplente" || status === "adimplente") {
      if (!applyCompliance) {
        if (status === "inadimplente") {
          res.json({ rows: [], total, filtered: 0 });
          return;
        }
      } else if (status === "inadimplente") {
        whereParts.push(
          "NOT EXISTS (SELECT 1 FROM mensalidades m2 WHERE m2.idinscrito = i.idinscritos AND m2.competencia = ?)"
        );
        params.push(competencia);
      } else if (status === "adimplente") {
        whereParts.push(
          "EXISTS (SELECT 1 FROM mensalidades m2 WHERE m2.idinscrito = i.idinscritos AND m2.competencia = ?)"
        );
        params.push(competencia);
      }
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const [rows] = await pool.query(
      `${baseSelect}${whereClause} ORDER BY i.nome`,
      params
    );

    const [filteredRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM inscritos i ${whereClause}`,
      params
    );
    const filtered = filteredRows?.[0]?.total || 0;
    if (status === "inadimplente" && !applyCompliance) {
      res.json({ rows: [], total, filtered: 0 });
      return;
    }
    res.json({ rows, total, filtered: search || status !== "todos" ? filtered : total });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar inscritos" });
  }
});

app.get("/api/enquetes", requireAuth, async (req, res) => {
  try {
    const status = req.query.status;
    const statusList = status ? [String(status)] : undefined;
    const data = await fetchEnquetes({ statusList });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar enquetes" });
  }
});

app.post("/api/enquetes", requireAuth, async (req, res) => {
  const { titulo, descricao, opcoes } = req.body || {};
  const cleanTitle = String(titulo || "").trim();
  const cleanOptions = Array.isArray(opcoes)
    ? opcoes.map((opt) => String(opt || "").trim()).filter(Boolean)
    : [];

  if (!cleanTitle) {
    res.status(400).json({ error: "Titulo e obrigatorio" });
    return;
  }
  if (cleanOptions.length < 2 || cleanOptions.length > 4) {
    res.status(400).json({ error: "A enquete deve ter entre 2 e 4 opcoes" });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      "INSERT INTO enquetes (titulo, descricao, status, created_at, updated_at) VALUES (?, ?, 'aberta', NOW(), NOW())",
      [cleanTitle, descricao || null]
    );
    const pollId = result.insertId;
    const values = cleanOptions.map((opt) => [pollId, opt]);
    await connection.query(
      "INSERT INTO enquete_opcoes (idenquete, texto) VALUES ?",
      [values]
    );
    await connection.commit();
    res.status(201).json({ idenquete: pollId });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: "Erro ao criar enquete" });
  } finally {
    connection.release();
  }
});

app.put("/api/enquetes/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status, titulo, descricao } = req.body || {};
  const updates = [];
  const params = [];

  if (titulo !== undefined) {
    const cleanTitle = String(titulo || "").trim();
    if (!cleanTitle) {
      res.status(400).json({ error: "Titulo nao pode ficar vazio" });
      return;
    }
    updates.push("titulo = ?");
    params.push(cleanTitle);
  }
  if (descricao !== undefined) {
    updates.push("descricao = ?");
    params.push(descricao || null);
  }
  if (status !== undefined) {
    if (!["aberta", "encerrada"].includes(status)) {
      res.status(400).json({ error: "Status invalido" });
      return;
    }
    updates.push("status = ?");
    params.push(status);
  }

  if (!updates.length) {
    res.status(400).json({ error: "Nenhuma alteracao informada" });
    return;
  }

  try {
    params.push(id);
    await pool.query(
      `UPDATE enquetes SET ${updates.join(", ")}, updated_at = NOW() WHERE idenquete = ?`,
      params
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar enquete" });
  }
});

app.get("/api/associado/enquetes", requireUserAuth, async (req, res) => {
  try {
    const data = await fetchEnquetes({ statusList: ["aberta"], userId: req.user.idinscrito });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar enquetes" });
  }
});

app.post("/api/associado/enquetes/:id/votar", requireUserAuth, async (req, res) => {
  const { id } = req.params;
  const { idopcao } = req.body || {};
  if (!idopcao) {
    res.status(400).json({ error: "Opcao e obrigatoria" });
    return;
  }
  try {
    const [pollRows] = await pool.query(
      "SELECT status FROM enquetes WHERE idenquete = ? LIMIT 1",
      [id]
    );
    if (!pollRows?.length) {
      res.status(404).json({ error: "Enquete nao encontrada" });
      return;
    }
    if (pollRows[0].status !== "aberta") {
      res.status(400).json({ error: "Enquete encerrada" });
      return;
    }
    const [optionRows] = await pool.query(
      "SELECT idopcao FROM enquete_opcoes WHERE idopcao = ? AND idenquete = ? LIMIT 1",
      [idopcao, id]
    );
    if (!optionRows?.length) {
      res.status(400).json({ error: "Opcao invalida" });
      return;
    }
    const [existingVote] = await pool.query(
      "SELECT idvoto FROM enquete_votos WHERE idenquete = ? AND idinscrito = ? LIMIT 1",
      [id, req.user.idinscrito]
    );
    if (existingVote?.length) {
      res.status(409).json({ error: "Voce ja votou nesta enquete" });
      return;
    }
    await pool.query(
      "INSERT INTO enquete_votos (idenquete, idopcao, idinscrito) VALUES (?, ?, ?)",
      [id, idopcao, req.user.idinscrito]
    );
    const data = await fetchEnquetes({ statusList: ["aberta", "encerrada"], userId: req.user.idinscrito });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Erro ao registrar voto" });
  }
});

app.post("/api/associado/login", async (req, res) => {
  const { email, cpf } = req.body || {};
  const trimmedEmail = String(email || "").trim();
  const cpfInput = normalizeCpf(cpf);
  if (!trimmedEmail || !cpfInput) {
    res.status(400).json({ error: "Email e CPF sao obrigatorios" });
    return;
  }
  try {
    const [rows] = await pool.query(
      "SELECT idinscritos, nome, cpf, email FROM inscritos WHERE LOWER(email) = LOWER(?) LIMIT 1",
      [trimmedEmail]
    );
    const user = rows?.[0];
    if (!user) {
      res.status(401).json({ error: "Credenciais invalidas" });
      return;
    }
    const cpfDb = normalizeCpf(user.cpf);
    if (!cpfDb) {
      res.status(400).json({
        error:
          "Seu CPF nao esta cadastrado. Entre em contato pelo email tarraf2@gmail.com ou pelo grupo da associacao no WhatsApp."
      });
      return;
    }
    if (cpfDb !== cpfInput) {
      res.status(401).json({ error: "Credenciais invalidas" });
      return;
    }
    const token = signUserToken({
      idinscrito: user.idinscritos,
      email: user.email,
      nome: user.nome
    });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: "Erro ao autenticar associado" });
  }
});

app.get("/api/associado/me", requireUserAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT idinscritos, nome, cpf, email, rua, numero, telefone, profissao FROM inscritos WHERE idinscritos = ? LIMIT 1",
      [req.user.idinscrito]
    );
    if (!rows?.[0]) {
      res.status(404).json({ error: "Associado nao encontrado" });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar associado" });
  }
});

app.put("/api/associado/me", requireUserAuth, async (req, res) => {
  const { nome, rua, numero, telefone, profissao } = req.body || {};
  try {
    await pool.query(
      "UPDATE inscritos SET nome = ?, rua = ?, numero = ?, telefone = ?, profissao = ?, updated_at = NOW() WHERE idinscritos = ?",
      [
        nome || null,
        rua || null,
        numero || null,
        telefone || null,
        profissao || null,
        req.user.idinscrito
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar dados do associado" });
  }
});

app.get("/api/associado/pagamentos", requireUserAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT idmensalidade, competencia, meses, valor_mensal, doacao, valor_total, data_pagamento, created_at, updated_at FROM mensalidades WHERE idinscrito = ? ORDER BY data_pagamento DESC, idmensalidade DESC",
      [req.user.idinscrito]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar pagamentos" });
  }
});

app.get("/api/mensalidades", requireAuth, async (req, res) => {
  const inscritoId = req.query.inscrito_id;
  try {
    const [rows] = inscritoId
      ? await pool.query(
          "SELECT idmensalidade, idinscrito, competencia, meses, valor_mensal, doacao, valor_total, data_pagamento, created_at, updated_at FROM mensalidades WHERE idinscrito = ? ORDER BY data_pagamento DESC, idmensalidade DESC",
          [inscritoId]
        )
      : await pool.query(
          "SELECT idmensalidade, idinscrito, competencia, meses, valor_mensal, doacao, valor_total, data_pagamento, created_at, updated_at FROM mensalidades ORDER BY data_pagamento DESC, idmensalidade DESC"
        );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar mensalidades" });
  }
});

app.get("/api/despesas", requireAuth, async (req, res) => {
  const month = req.query.month;
  try {
    const params = [];
    let where = "WHERE deleted_at IS NULL";
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      where += " AND data_despesa >= ? AND data_despesa < DATE_ADD(?, INTERVAL 1 MONTH)";
      params.push(`${month}-01`, `${month}-01`);
    }
    const [rows] = await pool.query(
      "SELECT iddespesa, data_despesa, valor, beneficiario, descricao, created_at, updated_at " +
        `FROM despesas ${where} ORDER BY data_despesa DESC, iddespesa DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar despesas" });
  }
});

app.post("/api/despesas", requireAuth, async (req, res) => {
  const { data_despesa, valor, beneficiario, descricao } = req.body || {};
  const valorNum = Number(valor);
  if (!data_despesa) {
    res.status(400).json({ error: "Data da despesa e obrigatoria" });
    return;
  }
  if (!beneficiario || !String(beneficiario).trim()) {
    res.status(400).json({ error: "Beneficiario e obrigatorio" });
    return;
  }
  if (!Number.isFinite(valorNum) || valorNum < 0) {
    res.status(400).json({ error: "Valor deve ser um numero valido" });
    return;
  }
  const hash = createDespesaHash({
    data_despesa,
    valor: valorNum,
    beneficiario,
    descricao
  });
  try {
    const [result] = await pool.query(
      "INSERT INTO despesas (data_despesa, valor, beneficiario, descricao, hash, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
      [data_despesa, valorNum, String(beneficiario).trim(), descricao || null, hash]
    );
    res.status(201).json({
      iddespesa: result.insertId,
      data_despesa,
      valor: valorNum,
      beneficiario: String(beneficiario).trim(),
      descricao: descricao || null
    });
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "Despesa ja cadastrada" });
      return;
    }
    res.status(500).json({ error: "Erro ao cadastrar despesa" });
  }
});

app.delete("/api/despesas/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      "UPDATE despesas SET deleted_at = NOW(), updated_at = NOW() WHERE iddespesa = ? AND deleted_at IS NULL",
      [id]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Despesa nao encontrada" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao remover despesa" });
  }
});

app.post("/api/despesas/import", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Arquivo nao enviado" });
    return;
  }
  const filePath = req.file.path;
  try {
    const { stdout } = await execFileAsync("pdftotext", ["-layout", filePath, "-"]);
    const rows = parseStatementText(stdout || "");
    res.json({ rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: "Nao foi possivel processar o extrato" });
  } finally {
    try {
      await fs.unlink(filePath);
    } catch (cleanupErr) {
      // ignore cleanup failures
    }
  }
});

app.post("/api/despesas/bulk", requireAuth, async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) {
    res.status(400).json({ error: "Nenhuma despesa informada" });
    return;
  }
  const values = [];
  const params = [];
  for (const row of rows) {
    const data = row.data_despesa;
    const valor = Number(row.valor);
    const beneficiario = String(row.beneficiario || "").trim();
    const descricao = row.descricao ? String(row.descricao).trim() : null;
    if (!data || !beneficiario || !Number.isFinite(valor) || valor <= 0) {
      res.status(400).json({ error: "Despesa invalida" });
      return;
    }
    const hash = createDespesaHash({
      data_despesa: data,
      valor,
      beneficiario,
      descricao
    });
    values.push("(?, ?, ?, ?, ?, NOW(), NOW())");
    params.push(data, valor, beneficiario, descricao, hash);
  }
  try {
    const [result] = await pool.query(
      `INSERT IGNORE INTO despesas (data_despesa, valor, beneficiario, descricao, hash, created_at, updated_at) VALUES ${values.join(", ")}`,
      params
    );
    const inserted = result?.affectedRows ?? 0;
    res.json({ ok: true, total: rows.length, inserted, skipped: rows.length - inserted });
  } catch (err) {
    res.status(500).json({ error: "Erro ao importar despesas" });
  }
});

app.get("/api/creditos", requireAuth, async (req, res) => {
  const month = req.query.month;
  try {
    const params = [];
    let where = "WHERE 1=1";
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      where += " AND c.data_credito >= ? AND c.data_credito < DATE_ADD(?, INTERVAL 1 MONTH)";
      params.push(`${month}-01`, `${month}-01`);
    }
    const [rows] = await pool.query(
      "SELECT c.idcredito, c.data_credito, c.valor, c.pagador_nome, c.pagador_documento, c.descricao, " +
        "c.match_status, c.idinscrito, c.idmensalidade, c.created_at " +
        `FROM creditos c ${where} ORDER BY c.data_credito DESC, c.idcredito DESC`,
      params
    );
    const ids = rows.map((row) => row.idcredito);
    if (!ids.length) {
      res.json([]);
      return;
    }
    const [candidates] = await pool.query(
      "SELECT idcredito, idinscrito, score, origem FROM creditos_match_candidatos WHERE idcredito IN (?)",
      [ids]
    );
    const [inscritos] = await pool.query(
      "SELECT idinscritos, nome FROM inscritos WHERE idinscritos IN (?)",
      [Array.from(new Set(candidates.map((item) => item.idinscrito)))]
    );
    const inscritoMap = inscritos.reduce((acc, item) => {
      acc[item.idinscritos] = item.nome;
      return acc;
    }, {});
    const candidatesByCredito = candidates.reduce((acc, item) => {
      if (!acc[item.idcredito]) acc[item.idcredito] = [];
      acc[item.idcredito].push({
        idinscrito: item.idinscrito,
        nome: inscritoMap[item.idinscrito] || `ID ${item.idinscrito}`,
        score: Number(item.score || 0),
        origem: item.origem
      });
      return acc;
    }, {});
    res.json(
      rows.map((row) => ({
        ...row,
        associado_nome: row.idinscrito ? inscritoMap[row.idinscrito] : null,
        candidatos: candidatesByCredito[row.idcredito] || []
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar creditos" });
  }
});

app.post("/api/creditos/import", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Arquivo nao enviado" });
    return;
  }
  const filePath = req.file.path;
  try {
    const { stdout } = await execFileAsync("pdftotext", ["-layout", filePath, "-"]);
    const rows = parseStatementCredits(stdout || "");
    if (!rows.length) {
      res.json({ rows: [], total: 0 });
      return;
    }
    const [inscritosRows] = await pool.query(
      "SELECT idinscritos, nome, cpf FROM inscritos"
    );
    const inscritos = inscritosRows.map((item) => {
      const nomeNorm = normalizeName(item.nome);
      return {
        ...item,
        cpfMiddle: getMiddleSixDigits(item.cpf),
        nomeTokens: nomeNorm.split(" ").filter((token) => token.length >= 3)
      };
    });
    const inscritoById = inscritos.reduce((acc, item) => {
      acc[item.idinscritos] = item.nome;
      return acc;
    }, {});
    const period = parseStatementPeriod(stdout || "");
    const periodoInicio = period?.start ? toIsoDateFull(period.start) : null;
    const periodoFim = period?.end ? toIsoDateFull(period.end) : null;
    const [importResult] = await pool.query(
      "INSERT INTO creditos_imports (periodo_inicio, periodo_fim, created_at) VALUES (?, ?, NOW())",
      [periodoInicio, periodoFim]
    );
    const importId = importResult.insertId;
    const responseRows = [];
    for (const row of rows) {
      const matchInfo = computeMatchCandidates(row, inscritos);
      const hash = createCreditoHash(row);
      const [result] = await pool.query(
        "INSERT INTO creditos (idimport, data_credito, valor, pagador_nome, pagador_documento, descricao, hash, match_status, idinscrito, created_at, updated_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()) " +
          "ON DUPLICATE KEY UPDATE idcredito = LAST_INSERT_ID(idcredito), updated_at = updated_at",
        [
          importId,
          row.data_credito,
          row.valor,
          row.pagador_nome,
          row.pagador_documento || null,
          row.descricao || null,
          hash,
          matchInfo.status,
          matchInfo.idinscrito
        ]
      );
      const idcredito = result.insertId;
      await pool.query("DELETE FROM creditos_match_candidatos WHERE idcredito = ?", [
        idcredito
      ]);
      if (matchInfo.candidates?.length) {
        const values = matchInfo.candidates.map(() => "(?, ?, ?, ?)");
        const params = [];
        matchInfo.candidates.forEach((cand) => {
          params.push(idcredito, cand.idinscrito, cand.score, cand.origem);
        });
        await pool.query(
          `INSERT INTO creditos_match_candidatos (idcredito, idinscrito, score, origem) VALUES ${values.join(", ")}`,
          params
        );
      }
      responseRows.push({
        idcredito,
        ...row,
        match_status: matchInfo.status,
        idinscrito: matchInfo.idinscrito,
        associado_nome: matchInfo.idinscrito ? inscritoById[matchInfo.idinscrito] : null,
        candidatos: matchInfo.candidates || []
      });
    }
    res.json({ rows: responseRows, total: responseRows.length, import_id: importId });
  } catch (err) {
    res.status(500).json({ error: "Nao foi possivel processar o extrato" });
  } finally {
    try {
      await fs.unlink(filePath);
    } catch (cleanupErr) {
      // ignore cleanup failures
    }
  }
});

app.post("/api/creditos/:id/match", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { idinscrito } = req.body || {};
  if (!idinscrito) {
    res.status(400).json({ error: "Informe o associado" });
    return;
  }
  try {
    const [rows] = await pool.query(
      "SELECT pagador_nome, pagador_documento FROM creditos WHERE idcredito = ?",
      [id]
    );
    if (!rows.length) {
      res.status(404).json({ error: "Credito nao encontrado" });
      return;
    }
    const { pagador_nome, pagador_documento } = rows[0];
    const [result] = await pool.query(
      "UPDATE creditos SET idinscrito = ?, match_status = 'matched', updated_at = NOW() WHERE idcredito = ?",
      [idinscrito, id]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Credito nao encontrado" });
      return;
    }
    const [bulkResult] = await pool.query(
      "UPDATE creditos SET idinscrito = ?, match_status = 'matched', updated_at = NOW() " +
        "WHERE match_status = 'ambiguous' AND idinscrito IS NULL AND pagador_nome <=> ? AND pagador_documento <=> ?",
      [idinscrito, pagador_nome, pagador_documento]
    );
    const [matchedRows] = await pool.query(
      "SELECT idcredito FROM creditos WHERE idinscrito = ? AND pagador_nome <=> ? AND pagador_documento <=> ?",
      [idinscrito, pagador_nome, pagador_documento]
    );
    res.json({
      ok: true,
      updated: bulkResult.affectedRows + result.affectedRows,
      matched_ids: matchedRows.map((item) => item.idcredito)
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar credito" });
  }
});

app.post("/api/creditos/importar", requireAuth, async (req, res) => {
  const { month } = req.body || {};
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: "Mes invalido" });
    return;
  }
  const competencia = `${month}-01`;
  try {
    const [rows] = await pool.query(
      "SELECT idcredito, idinscrito, valor, data_credito FROM creditos " +
        "WHERE match_status = 'matched' AND idmensalidade IS NULL AND data_credito >= ? " +
        "AND data_credito < DATE_ADD(?, INTERVAL 1 MONTH)",
      [`${month}-01`, `${month}-01`]
    );
    let inserted = 0;
    let skipped = 0;
    for (const row of rows) {
      const valorNum = Number(row.valor || 0);
      const doacao = Math.max(0, Number((valorNum - 30).toFixed(2)));
      const [existing] = await pool.query(
        "SELECT idmensalidade FROM mensalidades WHERE idinscrito = ? AND competencia = ? LIMIT 1",
        [row.idinscrito, competencia]
      );
      if (existing?.length) {
        skipped += 1;
        continue;
      }
      const [result] = await pool.query(
        "INSERT INTO mensalidades (idinscrito, competencia, meses, valor_mensal, doacao, valor_total, data_pagamento) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          row.idinscrito,
          competencia,
          1,
          MONTHLY_FEE,
          doacao,
          valorNum,
          row.data_credito
        ]
      );
      await pool.query(
        "UPDATE creditos SET idmensalidade = ?, match_status = 'importado', updated_at = NOW() WHERE idcredito = ?",
        [result.insertId, row.idcredito]
      );
      inserted += 1;
    }
    res.json({ ok: true, total: rows.length, inserted, skipped });
  } catch (err) {
    res.status(500).json({ error: "Erro ao importar mensalidades" });
  }
});

app.get("/api/resumo-mensal", requireAuth, async (req, res) => {
  try {
    const [despesas] = await pool.query(
      "SELECT DATE_FORMAT(data_despesa, '%Y-%m') AS mes, COUNT(*) AS total, SUM(valor) AS valor " +
        "FROM despesas WHERE deleted_at IS NULL GROUP BY mes"
    );
    const [creditos] = await pool.query(
      "SELECT DATE_FORMAT(data_credito, '%Y-%m') AS mes, COUNT(*) AS total, SUM(valor) AS valor, " +
        "SUM(match_status = 'matched') AS matched, SUM(match_status = 'ambiguous') AS ambiguous, " +
        "SUM(match_status = 'unmatched') AS unmatched " +
        "FROM creditos GROUP BY mes"
    );
    const map = {};
    despesas.forEach((row) => {
      map[row.mes] = {
        mes: row.mes,
        despesas_total: Number(row.valor || 0),
        despesas_count: Number(row.total || 0),
        creditos_total: 0,
        creditos_count: 0,
        creditos_matched: 0,
        creditos_ambiguous: 0,
        creditos_unmatched: 0
      };
    });
    creditos.forEach((row) => {
      if (!map[row.mes]) {
        map[row.mes] = {
          mes: row.mes,
          despesas_total: 0,
          despesas_count: 0,
          creditos_total: 0,
          creditos_count: 0,
          creditos_matched: 0,
          creditos_ambiguous: 0,
          creditos_unmatched: 0
        };
      }
      map[row.mes].creditos_total = Number(row.valor || 0);
      map[row.mes].creditos_count = Number(row.total || 0);
      map[row.mes].creditos_matched = Number(row.matched || 0);
      map[row.mes].creditos_ambiguous = Number(row.ambiguous || 0);
      map[row.mes].creditos_unmatched = Number(row.unmatched || 0);
    });
    const result = Object.values(map).sort((a, b) => b.mes.localeCompare(a.mes));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Erro ao gerar resumo" });
  }
});

app.post("/api/mensalidades", requireAuth, async (req, res) => {
  const { idinscrito, competencia, meses, doacao, data_pagamento } = req.body || {};
  const mesesInt = Number.isFinite(Number(meses)) ? Number(meses) : 1;
  const doacaoNum = Number.isFinite(Number(doacao)) ? Number(doacao) : 0;
  if (!idinscrito || !competencia) {
    res.status(400).json({ error: "idinscrito e competencia sao obrigatorios" });
    return;
  }
  if (!Number.isInteger(mesesInt) || mesesInt < 1) {
    res.status(400).json({ error: "meses deve ser um inteiro maior que zero" });
    return;
  }
  if (doacaoNum < 0) {
    res.status(400).json({ error: "doacao nao pode ser negativa" });
    return;
  }
  const valorMensal = MONTHLY_FEE;
  const valorTotal = Number((mesesInt * valorMensal + doacaoNum).toFixed(2));
  try {
    const [existing] = await pool.query(
      "SELECT COUNT(*) AS total FROM mensalidades WHERE idinscrito = ? AND competencia = ?",
      [idinscrito, competencia]
    );
    if (existing?.[0]?.total > 0) {
      res.status(409).json({ error: "Pagamento ja registrado para esta competencia" });
      return;
    }
    const [result] = await pool.query(
      "INSERT INTO mensalidades (idinscrito, competencia, meses, valor_mensal, doacao, valor_total, data_pagamento) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        idinscrito,
        competencia,
        mesesInt,
        valorMensal,
        doacaoNum,
        valorTotal,
        data_pagamento || new Date().toISOString().slice(0, 10)
      ]
    );
    res.status(201).json({
      idmensalidade: result.insertId,
      idinscrito,
      competencia,
      meses: mesesInt,
      valor_mensal: valorMensal,
      doacao: doacaoNum,
      valor_total: valorTotal,
      data_pagamento: data_pagamento || new Date().toISOString().slice(0, 10)
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao registrar mensalidade" });
  }
});

app.delete("/api/mensalidades/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query("DELETE FROM mensalidades WHERE idmensalidade = ?", [id]);
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Pagamento nao encontrado" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao remover pagamento" });
  }
});

app.put("/api/inscritos/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { cpf, rua, numero, telefone, email, profissao } = req.body || {};
  try {
    if (!cpf || !normalizeCpf(cpf)) {
      res.status(400).json({ error: "CPF e obrigatorio" });
      return;
    }
    if (!email || !normalizeEmail(email)) {
      res.status(400).json({ error: "Email e obrigatorio" });
      return;
    }
    const normalizedCpf = normalizeCpf(cpf);
    const normalizedEmail = normalizeEmail(email);
    const [cpfRows] = await pool.query(
      "SELECT idinscritos FROM inscritos WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ? AND idinscritos <> ? LIMIT 1",
      [normalizedCpf, id]
    );
    if (cpfRows?.length) {
      res.status(409).json({ error: "CPF ja cadastrado" });
      return;
    }
    const [emailRows] = await pool.query(
      "SELECT idinscritos FROM inscritos WHERE LOWER(email) = ? AND idinscritos <> ? LIMIT 1",
      [normalizedEmail, id]
    );
    if (emailRows?.length) {
      res.status(409).json({ error: "Email ja cadastrado" });
      return;
    }
    const [result] = await pool.query(
      "UPDATE inscritos SET cpf = ?, rua = ?, numero = ?, telefone = ?, email = ?, profissao = ?, updated_at = NOW() WHERE idinscritos = ?",
      [cpf || null, rua || null, numero || null, telefone || null, email || null, profissao || null, id]
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: "Inscrito nao encontrado" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar inscrito" });
  }
});

app.post("/api/inscritos", requireAuth, async (req, res) => {
  const { nome, cpf, rua, numero, telefone, email, profissao } = req.body || {};
  if (!nome || !String(nome).trim()) {
    res.status(400).json({ error: "Nome e obrigatorio" });
    return;
  }
  if (!cpf || !normalizeCpf(cpf)) {
    res.status(400).json({ error: "CPF e obrigatorio" });
    return;
  }
  if (!email || !normalizeEmail(email)) {
    res.status(400).json({ error: "Email e obrigatorio" });
    return;
  }
  const normalizedCpf = normalizeCpf(cpf);
  const normalizedEmail = normalizeEmail(email);
  try {
    const [cpfRows] = await pool.query(
      "SELECT idinscritos FROM inscritos WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ? LIMIT 1",
      [normalizedCpf]
    );
    if (cpfRows?.length) {
      res.status(409).json({ error: "CPF ja cadastrado" });
      return;
    }
    const [emailRows] = await pool.query(
      "SELECT idinscritos FROM inscritos WHERE LOWER(email) = ? LIMIT 1",
      [normalizedEmail]
    );
    if (emailRows?.length) {
      res.status(409).json({ error: "Email ja cadastrado" });
      return;
    }
    const [result] = await pool.query(
      "INSERT INTO inscritos (nome, cpf, rua, numero, telefone, email, profissao, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
      [
        String(nome).trim(),
        cpf || null,
        rua || null,
        numero || null,
        telefone || null,
        email || null,
        profissao || null
      ]
    );
    res.status(201).json({
      idinscritos: result.insertId,
      nome: String(nome).trim(),
      cpf: cpf || null,
      rua: rua || null,
      numero: numero || null,
      telefone: telefone || null,
      email: email || null,
      profissao: profissao || null
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar associado" });
  }
});

app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
