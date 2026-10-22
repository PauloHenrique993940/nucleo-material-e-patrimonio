-- Permit requested audit deletions inside an explicit administrative API transaction.
CREATE OR REPLACE FUNCTION public.preserve_audit_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.purge_audit', true) = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Histórico imutável: utilize a exclusão administrativa da auditoria.';
END;
$$;
DROP TRIGGER IF EXISTS audit_history_immutable ON public."AuditLog";
CREATE TRIGGER audit_history_immutable BEFORE DELETE OR UPDATE ON public."AuditLog"
FOR EACH ROW EXECUTE FUNCTION public.preserve_audit_history();