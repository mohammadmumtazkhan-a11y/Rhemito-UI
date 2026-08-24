CREATE TABLE "payment_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"request_number" text NOT NULL,
	"payer_id" varchar,
	"payer_email" text NOT NULL,
	"payer_name" text NOT NULL,
	"payer_email_masked" text NOT NULL,
	"payment_method" text NOT NULL,
	"pay_currency" text NOT NULL,
	"pay_amount_minor" bigint NOT NULL,
	"fee_minor" bigint NOT NULL,
	"absorb_fee" boolean NOT NULL,
	"fx_rate" text,
	"status" text DEFAULT 'session_open' NOT NULL,
	"payment_reference" text NOT NULL,
	"provider_intent_id" text,
	"provider_payment_ref" text,
	"failure_reason" text,
	"session_started_at" timestamp DEFAULT now(),
	"session_expires_at" timestamp,
	"authorisation_started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "request_renewal_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"request_number" text NOT NULL,
	"requester_id" varchar NOT NULL,
	"payer_email" text,
	"requested_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "money_requests" ADD COLUMN "absorb_fee" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "money_requests" ADD COLUMN "email_token" text;--> statement-breakpoint
ALTER TABLE "money_requests" ADD COLUMN "email_token_hash" text;--> statement-breakpoint
ALTER TABLE "money_requests" ADD COLUMN "recipient_email_masked" text;--> statement-breakpoint
ALTER TABLE "money_requests" ADD COLUMN "payer_user_id" varchar;--> statement-breakpoint
ALTER TABLE "money_requests" ADD COLUMN "payer_name" text;--> statement-breakpoint
ALTER TABLE "money_requests" ADD COLUMN "payer_email" text;--> statement-breakpoint
ALTER TABLE "money_requests" ADD COLUMN "payer_email_masked" text;--> statement-breakpoint
ALTER TABLE "money_requests" ADD COLUMN "active_session_id" text;--> statement-breakpoint
ALTER TABLE "money_requests" ADD COLUMN "session_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "money_requests" ADD COLUMN "reserved_attempt_id" text;--> statement-breakpoint
ALTER TABLE "money_requests" ADD COLUMN "due_date" text;