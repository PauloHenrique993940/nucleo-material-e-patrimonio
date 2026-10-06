ALTER TABLE "Material" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Permit only the explicit, transaction-scoped purge of one material's ledger.
-- Updates and unrelated deletions remain protected; audit records remain immutable.
CREATE OR REPLACE FUNCTION public.preserve_stock_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND OLD."materialId" = current_setting('app.purge_material_id', true) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Histórico imutável: registre uma operação de correção.';
END;
$$;

DROP TRIGGER IF EXISTS stock_history_immutable ON public."StockMovement";
CREATE TRIGGER stock_history_immutable BEFORE DELETE OR UPDATE
ON public."StockMovement" FOR EACH ROW EXECUTE FUNCTION public.preserve_stock_history();
