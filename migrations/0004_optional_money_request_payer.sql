ALTER TABLE "money_requests" ALTER COLUMN "sender_name" DROP NOT NULL;
ALTER TABLE "money_requests" ALTER COLUMN "sender_email" DROP NOT NULL;
ALTER TABLE "money_requests" ADD COLUMN "sender_id" varchar;
ALTER TABLE "money_requests" ADD COLUMN "payer_source_bank_name" text;
ALTER TABLE "money_requests" ADD COLUMN "payer_source_account_masked" text;
ALTER TABLE "money_requests" ADD COLUMN "payer_source_origin" text;
