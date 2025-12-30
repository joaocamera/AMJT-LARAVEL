CREATE TABLE IF NOT EXISTS inscritos (
  idinscritos INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(20) NOT NULL,
  rua VARCHAR(255) DEFAULT NULL,
  numero VARCHAR(20) DEFAULT NULL,
  telefone VARCHAR(30) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  profissao VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (idinscritos),
  UNIQUE KEY uniq_inscritos_cpf (cpf),
  UNIQUE KEY uniq_inscritos_email (email),
  KEY idx_inscritos_nome (nome),
  KEY idx_inscritos_cpf (cpf)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
