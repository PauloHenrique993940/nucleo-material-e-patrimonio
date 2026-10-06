-- Recovered from the PostgreSQL backup. Safe for databases with the original invariants.
CREATE OR REPLACE FUNCTION public.preserve_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION 'Histórico imutável: registre uma operação de correção.'; END; $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Material_limits_valid' AND conrelid = 'public."Material"'::regclass) THEN
    ALTER TABLE public."Material" ADD CONSTRAINT "Material_limits_valid" CHECK (((minimum >= 0) AND (maximum >= minimum) AND ("unitPrice" >= (0)::numeric)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Material_quantity_nonnegative' AND conrelid = 'public."Material"'::regclass) THEN
    ALTER TABLE public."Material" ADD CONSTRAINT "Material_quantity_nonnegative" CHECK ((quantity >= 0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Patrimony_value_nonnegative' AND conrelid = 'public."Patrimony"'::regclass) THEN
    ALTER TABLE public."Patrimony" ADD CONSTRAINT "Patrimony_value_nonnegative" CHECK ((value >= (0)::numeric));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_balance_valid' AND conrelid = 'public."StockMovement"'::regclass) THEN
    ALTER TABLE public."StockMovement" ADD CONSTRAINT "StockMovement_balance_valid" CHECK ((("previousBalance" >= 0) AND ("currentBalance" >= 0) AND ("unitPrice" >= (0)::numeric) AND
CASE
    WHEN (type = 'IN'::public."MovementType") THEN (("currentBalance")::bigint = (("previousBalance")::bigint + quantity))
    ELSE (("currentBalance")::bigint = (("previousBalance")::bigint - quantity))
END));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_quantity_positive' AND conrelid = 'public."StockMovement"'::regclass) THEN
    ALTER TABLE public."StockMovement" ADD CONSTRAINT "StockMovement_quantity_positive" CHECK ((quantity > 0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_history_immutable' AND tgrelid = 'public."AuditLog"'::regclass) THEN
    CREATE TRIGGER audit_history_immutable BEFORE DELETE OR UPDATE ON public."AuditLog" FOR EACH ROW EXECUTE FUNCTION public.preserve_history();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'stock_history_immutable' AND tgrelid = 'public."StockMovement"'::regclass) THEN
    CREATE TRIGGER stock_history_immutable BEFORE DELETE OR UPDATE ON public."StockMovement" FOR EACH ROW EXECUTE FUNCTION public.preserve_history();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'transfer_history_immutable' AND tgrelid = 'public."PatrimonyTransfer"'::regclass) THEN
    CREATE TRIGGER transfer_history_immutable BEFORE DELETE OR UPDATE ON public."PatrimonyTransfer" FOR EACH ROW EXECUTE FUNCTION public.preserve_history();
  END IF;
END;
$$;
