-- Corrige CPFs com zeros a esquerda ausentes (formato numerico com ate 10 digitos).
-- Execute em ambiente de manutencao e revise os conflitos antes do UPDATE.

START TRANSACTION;

-- Lista os registros que serao corrigidos.
SELECT
  t.idinscritos,
  t.cpf AS cpf_atual,
  LPAD(t.digits, 11, '0') AS cpf_corrigido
FROM (
  SELECT
    idinscritos,
    cpf,
    REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') AS digits
  FROM inscritos
) AS t
WHERE t.digits REGEXP '^[0-9]+$'
  AND LENGTH(t.digits) BETWEEN 1 AND 10;

-- Verifica possiveis conflitos de unicidade apos normalizar.
SELECT
  x.cpf_corrigido,
  COUNT(*) AS total
FROM (
  SELECT
    LPAD(t.digits, 11, '0') AS cpf_corrigido
  FROM (
    SELECT
      idinscritos,
      REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') AS digits
    FROM inscritos
  ) AS t
  WHERE t.digits REGEXP '^[0-9]+$'
    AND LENGTH(t.digits) BETWEEN 1 AND 11
) AS x
GROUP BY x.cpf_corrigido
HAVING COUNT(*) > 1;

-- Aplica a correcao para CPFs com 1 a 10 digitos.
UPDATE inscritos AS i
JOIN (
  SELECT
    idinscritos,
    LPAD(digits, 11, '0') AS cpf_corrigido
  FROM (
    SELECT
      idinscritos,
      REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') AS digits
    FROM inscritos
  ) AS t
  WHERE t.digits REGEXP '^[0-9]+$'
    AND LENGTH(t.digits) BETWEEN 1 AND 10
) AS u
ON i.idinscritos = u.idinscritos
SET i.cpf = u.cpf_corrigido;

COMMIT;

-- Se precisar desfazer, use ROLLBACK antes do COMMIT.
