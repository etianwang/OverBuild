DO $do$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'overbuild') THEN
    CREATE ROLE overbuild LOGIN PASSWORD 'overbuild';
  END IF;
END
$do$;

-- CREATE DATABASE 必须在事务外单独执行，见 setup-postgres-admin.ps1
