ALTER TABLE "invoices" ADD COLUMN "source" varchar;
ALTER TABLE "invoices" ADD COLUMN "items" jsonb;
ALTER TABLE "invoices" ADD COLUMN "tax_rate" text;
ALTER TABLE "invoices" ADD COLUMN "discount_type" varchar;
ALTER TABLE "invoices" ADD COLUMN "discount_value" text;
ALTER TABLE "invoices" ADD COLUMN "notes" text;
