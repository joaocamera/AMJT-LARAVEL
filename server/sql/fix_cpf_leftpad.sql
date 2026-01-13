-- Normaliza CPF para 11 digitos (remove pontuacao e completa com zeros a esquerda).
UPDATE inscritos
SET cpf = LPAD(
  REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', ''),
  11,
  '0'
)
WHERE cpf IS NOT NULL
  AND LENGTH(REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '')) < 11;
