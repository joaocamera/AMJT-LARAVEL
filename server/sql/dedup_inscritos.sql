-- Remove registros duplicados mantendo o menor idinscritos.
DELETE t1
FROM inscritos t1
JOIN inscritos t2
  ON t1.idinscritos > t2.idinscritos
 AND t1.nome <=> t2.nome
 AND t1.cpf <=> t2.cpf
 AND t1.rua <=> t2.rua
 AND t1.numero <=> t2.numero
 AND t1.telefone <=> t2.telefone
 AND t1.email <=> t2.email
 AND t1.profissao <=> t2.profissao
 AND t1.created_at <=> t2.created_at
 AND t1.updated_at <=> t2.updated_at;
