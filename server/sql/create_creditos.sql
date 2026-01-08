CREATE TABLE IF NOT EXISTS creditos_imports (
  idimport INT UNSIGNED NOT NULL AUTO_INCREMENT,
  periodo_inicio DATE DEFAULT NULL,
  periodo_fim DATE DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idimport)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS creditos (
  idcredito INT UNSIGNED NOT NULL AUTO_INCREMENT,
  idimport INT UNSIGNED DEFAULT NULL,
  data_credito DATE NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  pagador_nome VARCHAR(255) NOT NULL,
  pagador_documento VARCHAR(40) DEFAULT NULL,
  descricao TEXT DEFAULT NULL,
  hash CHAR(64) NOT NULL,
  match_status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  match_origin VARCHAR(16) NOT NULL DEFAULT 'auto',
  idinscrito INT UNSIGNED DEFAULT NULL,
  idmensalidade INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (idcredito),
  UNIQUE KEY uniq_creditos_hash (hash),
  KEY idx_creditos_data (data_credito),
  KEY idx_creditos_inscrito (idinscrito),
  KEY idx_creditos_import (idimport),
  KEY idx_creditos_status (match_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS creditos_match_candidatos (
  idcandidato INT UNSIGNED NOT NULL AUTO_INCREMENT,
  idcredito INT UNSIGNED NOT NULL,
  idinscrito INT UNSIGNED NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  origem VARCHAR(20) NOT NULL,
  PRIMARY KEY (idcandidato),
  KEY idx_candidatos_credito (idcredito)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
