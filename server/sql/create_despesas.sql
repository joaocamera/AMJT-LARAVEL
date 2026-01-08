CREATE TABLE IF NOT EXISTS despesas (
  iddespesa INT UNSIGNED NOT NULL AUTO_INCREMENT,
  data_despesa DATE NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  beneficiario VARCHAR(255) NOT NULL,
  descricao TEXT DEFAULT NULL,
  numero_nota VARCHAR(60) DEFAULT NULL,
  chave_nfe VARCHAR(60) DEFAULT NULL,
  hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (iddespesa),
  UNIQUE KEY uniq_despesas_hash (hash),
  KEY idx_despesas_data (data_despesa),
  KEY idx_despesas_beneficiario (beneficiario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
