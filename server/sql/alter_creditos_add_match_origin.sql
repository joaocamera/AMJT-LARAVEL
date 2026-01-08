ALTER TABLE creditos
  ADD COLUMN match_origin VARCHAR(16) NOT NULL DEFAULT 'auto' AFTER match_status;
