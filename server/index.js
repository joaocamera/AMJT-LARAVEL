import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import pool from "./db.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

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

app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
