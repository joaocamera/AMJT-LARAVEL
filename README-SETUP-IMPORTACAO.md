# Setup para Importacao de Extratos (outra maquina)

Este projeto agora permite importar despesas a partir de PDF (extrato Sicoob).

## Requisitos

- Node.js 20.x (recomendado)
- MySQL 8.x
- `pdftotext` no PATH (pacote `poppler-utils` no Linux)

## Dependencias

### Backend

```bash
cd server
npm install
```

### Frontend

```bash
cd web
npm install
```

## Banco de dados

1) Criar banco `amjt2` e usuario conforme `server/.env`.
2) Aplicar os scripts SQL:

```bash
mysql -u amjt2 -p -h localhost -P 3306 amjt2 < server/sql/create_despesas.sql
mysql -u amjt2 -p -h localhost -P 3306 amjt2 < server/sql/create_creditos.sql
mysql -u amjt2 -p -h localhost -P 3306 amjt2 < amjt2.sql
mysql -u amjt2 -p -h localhost -P 3306 amjt2 < server/sql/create_enquetes.sql
mysql -u amjt2 -p -h localhost -P 3306 amjt2 < server/sql/create_mensalidades.sql
mysql -u amjt2 -p -h localhost -P 3306 amjt2 < server/sql/create_inscritos.sql
```

## Variaveis de ambiente

Backend em `server/.env`:

```
PORT=3001
DB_HOST=localhost
DB_USER=amjt2
DB_PASSWORD=*******
DB_NAME=amjt2
ADMIN_USER=admin
ADMIN_PASS=1234
ADMIN_TOKEN=admin-token
VITE_API_URL=http://SEU_IP:3001
```

Frontend em `web/.env`:

```
VITE_API_URL=http://SEU_IP:3001
```

Substitua `SEU_IP` pelo IP da maquina do backend.

## Executar

Backend:

```bash
cd server
npm run dev
```

Frontend:

```bash
cd web
npm run dev -- --host 0.0.0.0
```

## Usar a importacao no admin

1) Entrar como admin.
2) Ir em `Despesas`.
3) Clique em `Importar extrato`.
4) Enviar PDF e clicar em `Analisar extrato`.
5) Conferir preview e clicar em `Importar despesas`.
