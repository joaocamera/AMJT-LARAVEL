ALTER TABLE despesas
  ADD COLUMN numero_nota VARCHAR(60) NULL AFTER descricao,
  ADD COLUMN chave_nfe VARCHAR(60) NULL AFTER numero_nota;
