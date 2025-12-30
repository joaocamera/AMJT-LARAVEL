CREATE TABLE IF NOT EXISTS mensalidades (
  idmensalidade INT UNSIGNED NOT NULL AUTO_INCREMENT,
  idinscrito INT UNSIGNED NOT NULL,
  competencia DATE NOT NULL,
  meses INT NOT NULL DEFAULT 1,
  valor_mensal DECIMAL(10,2) NOT NULL DEFAULT 30.00,
  doacao DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  valor_total DECIMAL(10,2) NOT NULL,
  data_pagamento DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (idmensalidade),
  UNIQUE KEY uniq_mensalidades_competencia (idinscrito, competencia),
  KEY idx_mensalidades_inscrito (idinscrito),
  KEY idx_mensalidades_competencia (competencia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
