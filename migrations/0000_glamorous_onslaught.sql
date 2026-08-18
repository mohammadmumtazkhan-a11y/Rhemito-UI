CREATE TABLE "auth_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"account_type" text DEFAULT 'individual' NOT NULL,
	"country" text NOT NULL,
	"first_name" text,
	"middle_name" text,
	"last_name" text,
	"date_of_birth" text,
	"gender" text,
	"mobile_code" text,
	"mobile_number" text,
	"business_name" text,
	"business_reg_no" text,
	"business_phone_code" text,
	"business_phone_number" text,
	"director_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"kyc_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "client_emails" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"to_email" text NOT NULL,
	"type" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"attachment_file_name" text,
	"attachment_mime_type" text,
	"attachment_size" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"attempt_count" text DEFAULT '1' NOT NULL,
	"last_attempt_at" timestamp DEFAULT now(),
	"dedupe_key" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "client_emails_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"attempts" text DEFAULT '0' NOT NULL,
	"dedupe_key" text NOT NULL,
	"last_attempt_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "email_deliveries_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "invoice_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploader_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" text NOT NULL,
	"data" text NOT NULL,
	"status" text DEFAULT 'temp' NOT NULL,
	"uploaded_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "invoice_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"actor" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_name" text NOT NULL,
	"client_type" text NOT NULL,
	"client_first_name" text,
	"client_middle_name" text,
	"client_last_name" text,
	"client_business_name" text,
	"client_email" text NOT NULL,
	"client_phone_code" text,
	"client_phone_number" text,
	"amount" text NOT NULL,
	"currency" text NOT NULL,
	"absorb_fee" boolean DEFAULT false NOT NULL,
	"payout_account_bank" text NOT NULL,
	"payout_account_number" text NOT NULL,
	"payout_account_name" text NOT NULL,
	"payout_account_currency" text NOT NULL,
	"payment_initiated_at" timestamp,
	"payment_method" text,
	"due_date" text,
	"expires_at" timestamp NOT NULL,
	"expiry_timezone" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"payment_ref" text,
	"token" text NOT NULL,
	"token_hash" text NOT NULL,
	"document_id" varchar,
	"sent_at" timestamp DEFAULT now(),
	"paid_at" timestamp,
	"expired_at" timestamp,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"cancelled_by" varchar,
	"due_reminder_sent_at" timestamp,
	"expiry_reminder_sent_at" timestamp,
	"new_link_requested_at" timestamp,
	"new_link_requested_by" text,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number"),
	CONSTRAINT "invoices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"type" text NOT NULL,
	"account" text NOT NULL,
	"direction" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"provider_ref" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "money_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_number" text NOT NULL,
	"requester_id" varchar NOT NULL,
	"requester_name" text NOT NULL,
	"requester_country" text NOT NULL,
	"corridor_id" text NOT NULL,
	"sender_country" text NOT NULL,
	"pay_in_currency" text NOT NULL,
	"pay_in_amount_minor" bigint NOT NULL,
	"payout_currency" text NOT NULL,
	"fee_minor" bigint NOT NULL,
	"payout_amount_minor" bigint,
	"fx_rate" text,
	"fx_rate_is_indicative" boolean DEFAULT true NOT NULL,
	"fx_markup_applied" text,
	"payout_account_id" varchar NOT NULL,
	"payout_account_masked" text NOT NULL,
	"payout_account_bank_name" text NOT NULL,
	"payout_account_holder_name" text NOT NULL,
	"payout_account_country" text NOT NULL,
	"sender_type" text NOT NULL,
	"sender_name" text NOT NULL,
	"sender_email" text NOT NULL,
	"sender_phone" text,
	"purpose" text NOT NULL,
	"reference" text,
	"status" text DEFAULT 'active' NOT NULL,
	"token" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"expiry_extended_once" boolean DEFAULT false NOT NULL,
	"viewed_at" timestamp,
	"payment_initiated_at" timestamp,
	"funded_at" timestamp,
	"payout_submitted_at" timestamp,
	"paid_out_at" timestamp,
	"cancelled_at" timestamp,
	"failure_reason" text,
	"payin_intent_id" text,
	"provider_payment_ref" text,
	"payout_provider_ref" text,
	"payment_method" text,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "money_requests_request_number_unique" UNIQUE("request_number"),
	CONSTRAINT "money_requests_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "notification_delivery_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" varchar NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" text DEFAULT '0' NOT NULL,
	"last_attempt_at" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"web_push_enabled" boolean DEFAULT false NOT NULL,
	"mobile_push_enabled" boolean DEFAULT false NOT NULL,
	"payment_events" boolean DEFAULT true NOT NULL,
	"transaction_events" boolean DEFAULT true NOT NULL,
	"refund_events" boolean DEFAULT true NOT NULL,
	"kyc_events" boolean DEFAULT true NOT NULL,
	"security_events" boolean DEFAULT true NOT NULL,
	"maintenance_events" boolean DEFAULT true NOT NULL,
	"marketing_events" boolean DEFAULT false NOT NULL,
	"quiet_hours_enabled" boolean DEFAULT false NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"channel" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payout_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar NOT NULL,
	"holder_name" text NOT NULL,
	"country" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"routing_number" text,
	"currency" text NOT NULL,
	"verification_status" text DEFAULT 'pending' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"verified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"min_amount" text DEFAULT '0',
	"currency" text DEFAULT 'GBP',
	"status" text DEFAULT 'active',
	"usage_count" text DEFAULT '0',
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp DEFAULT now(),
	"request_number" text
);
