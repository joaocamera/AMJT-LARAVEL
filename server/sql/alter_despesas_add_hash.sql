ALTER TABLE despesas ADD COLUMN hash CHAR(64) NULL AFTER descricao;

UPDATE despesas
SET hash = SHA2(CONCAT_WS('|', data_despesa, FORMAT(valor, 2), beneficiario, IFNULL(descricao, '')), 256)
WHERE hash IS NULL OR hash = '';

ALTER TABLE despesas MODIFY hash CHAR(64) NOT NULL;
ALTER TABLE despesas ADD UNIQUE KEY uniq_despesas_hash (hash);
