CREATE TABLE IF NOT EXISTS despesas_anexos (
  idanexo INT UNSIGNED NOT NULL AUTO_INCREMENT,
  iddespesa INT UNSIGNED NOT NULL,
  nome_original VARCHAR(255) NOT NULL,
  nome_armazenado VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  tamanho INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idanexo),
  KEY idx_despesas_anexos_despesa (iddespesa),
  CONSTRAINT fk_despesas_anexos_despesa FOREIGN KEY (iddespesa)
    REFERENCES despesas (iddespesa)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
