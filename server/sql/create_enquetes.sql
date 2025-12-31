CREATE TABLE IF NOT EXISTS enquetes (
  idenquete INT UNSIGNED NOT NULL AUTO_INCREMENT,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'aberta',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (idenquete),
  KEY idx_enquetes_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS enquete_opcoes (
  idopcao INT UNSIGNED NOT NULL AUTO_INCREMENT,
  idenquete INT UNSIGNED NOT NULL,
  texto VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idopcao),
  KEY idx_enquete_opcoes_enquete (idenquete)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS enquete_votos (
  idvoto INT UNSIGNED NOT NULL AUTO_INCREMENT,
  idenquete INT UNSIGNED NOT NULL,
  idopcao INT UNSIGNED NOT NULL,
  idinscrito INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idvoto),
  UNIQUE KEY uniq_enquete_voto (idenquete, idinscrito),
  KEY idx_enquete_votos_enquete (idenquete),
  KEY idx_enquete_votos_opcao (idopcao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
