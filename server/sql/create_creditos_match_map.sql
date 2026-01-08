CREATE TABLE IF NOT EXISTS creditos_match_map (
  idmap INT AUTO_INCREMENT PRIMARY KEY,
  idinscrito INT UNSIGNED NOT NULL,
  nome_norm VARCHAR(255) NOT NULL,
  doc_norm VARCHAR(32) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_creditos_match_map (nome_norm, doc_norm),
  CONSTRAINT fk_creditos_match_map_inscrito
    FOREIGN KEY (idinscrito) REFERENCES inscritos(idinscritos)
    ON DELETE CASCADE
);
