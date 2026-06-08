CREATE SCHEMA "pm";
--> statement-breakpoint
CREATE TYPE "pm"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "pm"."contract_status" AS ENUM('draft', 'awaiting_sales', 'awaiting_accounting', 'active', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "pm"."project_status" AS ENUM('pending', 'in_progress', 'ready_to_withdraw', 'installing', 'pending_close', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "pm"."quotation_status" AS ENUM('draft', 'pending', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "pm"."survey_status" AS ENUM('pending', 'scheduled', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "pm"."technician_role" AS ENUM('technician', 'assistant', 'lead');--> statement-breakpoint
CREATE TYPE "pm"."work_order_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "pm"."work_order_status" AS ENUM('assigned', 'in_progress', 'paused', 'done', 'cancelled');--> statement-breakpoint
CREATE TABLE "pm"."boq_docs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"doc_no" text NOT NULL,
	"doc_date" date DEFAULT now() NOT NULL,
	"project_id" bigint NOT NULL,
	"contract_id" bigint NOT NULL,
	"customer_code" text,
	"created_by" text,
	"status" "pm"."approval_status" DEFAULT 'pending' NOT NULL,
	"approver" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boq_docs_doc_no_unique" UNIQUE("doc_no")
);
--> statement-breakpoint
CREATE TABLE "pm"."boq_lines" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"boq_id" bigint NOT NULL,
	"line_no" integer DEFAULT 1 NOT NULL,
	"item_code" text NOT NULL,
	"item_name" text,
	"unit_code" text,
	"qty" numeric(18, 4) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm"."contracts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"legacy_roworder" integer,
	"legacy_contract_id" integer,
	"contract_no" text NOT NULL,
	"name" text,
	"project_id" bigint NOT NULL,
	"quotation_id" bigint,
	"customer_code" text,
	"customer_name" text,
	"customer_address" text,
	"customer_phone" text,
	"currency_code" text DEFAULT 'LAK' NOT NULL,
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"payment_type" text,
	"brand" text,
	"sign_date" date,
	"start_date" date,
	"end_date" date,
	"sales_approved" boolean DEFAULT false NOT NULL,
	"sales_approver" text,
	"sales_approved_at" timestamp with time zone,
	"accounting_approved" boolean DEFAULT false NOT NULL,
	"accounting_approver" text,
	"accounting_approved_at" timestamp with time zone,
	"status" "pm"."contract_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_legacy_roworder_unique" UNIQUE("legacy_roworder"),
	CONSTRAINT "contracts_legacy_contract_id_unique" UNIQUE("legacy_contract_id"),
	CONSTRAINT "contracts_contract_no_unique" UNIQUE("contract_no")
);
--> statement-breakpoint
CREATE TABLE "pm"."installment_lines" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"installment_id" bigint NOT NULL,
	"line_no" integer DEFAULT 1 NOT NULL,
	"description" text,
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm"."installments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"contract_id" bigint NOT NULL,
	"installment_no" integer NOT NULL,
	"total_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm"."project_attachments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" bigint NOT NULL,
	"contract_no" text,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm"."project_status_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" bigint NOT NULL,
	"contract_no" text,
	"entity_type" text NOT NULL,
	"field_name" text NOT NULL,
	"action_name" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_by" text,
	"note" text,
	"extra_payload" jsonb,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm"."projects" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"name" text NOT NULL,
	"description" text,
	"sml_code" text,
	"province_code" text,
	"district_code" text,
	"village_code" text,
	"coordinator" text,
	"phone" text,
	"image_url" text,
	"sale_code" text,
	"project_type_code" text,
	"business_type_code" text,
	"business_model_code" text,
	"office_lat" double precision,
	"office_lng" double precision,
	"project_lat" double precision,
	"project_lng" double precision,
	"status" "pm"."project_status" DEFAULT 'pending' NOT NULL,
	"registered_on" date,
	"closed_on" date,
	"closed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "pm"."surveys" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" bigint NOT NULL,
	"status" "pm"."survey_status" DEFAULT 'pending' NOT NULL,
	"surveyor" text,
	"scheduled_date" date,
	"completed_date" date,
	"findings" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm"."quotation_lines" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"quotation_id" bigint NOT NULL,
	"line_no" integer DEFAULT 1 NOT NULL,
	"item_code" text,
	"description" text,
	"unit_code" text,
	"qty" numeric(18, 4) DEFAULT '0' NOT NULL,
	"unit_price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"remark" text
);
--> statement-breakpoint
CREATE TABLE "pm"."quotations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"quotation_no" text NOT NULL,
	"project_id" bigint,
	"customer_name" text,
	"customer_address" text,
	"customer_phone" text,
	"quotation_date" date,
	"validity_date" date,
	"terms" text,
	"notes" text,
	"discount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_type" text DEFAULT '0' NOT NULL,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"status" "pm"."quotation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "quotations_quotation_no_unique" UNIQUE("quotation_no")
);
--> statement-breakpoint
CREATE TABLE "pm"."material_request_lines" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"request_id" bigint NOT NULL,
	"line_no" integer DEFAULT 1 NOT NULL,
	"item_code" text,
	"item_name" text,
	"unit_code" text,
	"qty" numeric(18, 4) DEFAULT '0' NOT NULL,
	"remark" text
);
--> statement-breakpoint
CREATE TABLE "pm"."material_requests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"doc_no" text NOT NULL,
	"doc_date" date DEFAULT now() NOT NULL,
	"boq_id" bigint,
	"boq_doc_no" text,
	"work_order_id" bigint,
	"project_id" bigint,
	"contract_no" text,
	"customer_code" text,
	"warehouse_from" text,
	"location_from" text,
	"creator_code" text,
	"requester_name" text,
	"remark" text,
	"fulfilled" boolean DEFAULT false NOT NULL,
	"withdraw_doc_no" text,
	"withdraw_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_requests_doc_no_unique" UNIQUE("doc_no")
);
--> statement-breakpoint
CREATE TABLE "pm"."technicians" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"phone" text,
	"role" "pm"."technician_role" DEFAULT 'technician' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm"."work_order_checkins" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"work_order_id" bigint NOT NULL,
	"actor" text,
	"lat" numeric(10, 6),
	"lng" numeric(10, 6),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm"."work_order_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"work_order_id" bigint NOT NULL,
	"boq_line_id" bigint,
	"item_code" text,
	"item_name" text,
	"unit_code" text,
	"qty" numeric(18, 4) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm"."work_order_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"work_order_id" bigint NOT NULL,
	"status" text,
	"note" text,
	"actor" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm"."work_order_materials" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"work_order_id" bigint NOT NULL,
	"item_code" text,
	"item_name" text,
	"unit_code" text,
	"qty" numeric(18, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm"."work_order_tasks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"work_order_id" bigint NOT NULL,
	"task_id" integer,
	"task_name" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm"."work_orders" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"project_id" bigint,
	"contract_id" bigint,
	"contract_no" text,
	"boq_id" bigint,
	"task_id" integer,
	"task_name" text,
	"title" text,
	"description" text,
	"technician_id" bigint,
	"helper_ids" jsonb DEFAULT '[]' NOT NULL,
	"status" "pm"."work_order_status" DEFAULT 'assigned' NOT NULL,
	"priority" "pm"."work_order_priority" DEFAULT 'normal' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_orders_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "pm"."work_schedule" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" bigint,
	"contract_id" bigint,
	"project_code" text,
	"contract_no" text,
	"phase" text,
	"task" text,
	"owner" text,
	"start_date" date,
	"end_date" date,
	"progress" integer DEFAULT 0 NOT NULL,
	"status" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pm"."boq_docs" ADD CONSTRAINT "boq_docs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "pm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."boq_docs" ADD CONSTRAINT "boq_docs_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "pm"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."boq_lines" ADD CONSTRAINT "boq_lines_boq_id_boq_docs_id_fk" FOREIGN KEY ("boq_id") REFERENCES "pm"."boq_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."contracts" ADD CONSTRAINT "contracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "pm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."contracts" ADD CONSTRAINT "contracts_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "pm"."quotations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."installment_lines" ADD CONSTRAINT "installment_lines_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "pm"."installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."installments" ADD CONSTRAINT "installments_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "pm"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."project_attachments" ADD CONSTRAINT "project_attachments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "pm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."surveys" ADD CONSTRAINT "surveys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "pm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."quotation_lines" ADD CONSTRAINT "quotation_lines_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "pm"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."quotations" ADD CONSTRAINT "quotations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "pm"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."material_request_lines" ADD CONSTRAINT "material_request_lines_request_id_material_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "pm"."material_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."material_requests" ADD CONSTRAINT "material_requests_boq_id_boq_docs_id_fk" FOREIGN KEY ("boq_id") REFERENCES "pm"."boq_docs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."material_requests" ADD CONSTRAINT "material_requests_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "pm"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."material_requests" ADD CONSTRAINT "material_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "pm"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."work_order_checkins" ADD CONSTRAINT "work_order_checkins_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "pm"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."work_order_items" ADD CONSTRAINT "work_order_items_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "pm"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."work_order_logs" ADD CONSTRAINT "work_order_logs_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "pm"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."work_order_materials" ADD CONSTRAINT "work_order_materials_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "pm"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."work_order_tasks" ADD CONSTRAINT "work_order_tasks_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "pm"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."work_orders" ADD CONSTRAINT "work_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "pm"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."work_orders" ADD CONSTRAINT "work_orders_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "pm"."contracts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."work_orders" ADD CONSTRAINT "work_orders_boq_id_boq_docs_id_fk" FOREIGN KEY ("boq_id") REFERENCES "pm"."boq_docs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."work_orders" ADD CONSTRAINT "work_orders_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "pm"."technicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."work_schedule" ADD CONSTRAINT "work_schedule_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "pm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."work_schedule" ADD CONSTRAINT "work_schedule_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "pm"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boq_docs_project_idx" ON "pm"."boq_docs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "boq_docs_contract_idx" ON "pm"."boq_docs" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "boq_docs_status_idx" ON "pm"."boq_docs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "boq_lines_boq_idx" ON "pm"."boq_lines" USING btree ("boq_id");--> statement-breakpoint
CREATE INDEX "contracts_project_idx" ON "pm"."contracts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "contracts_status_idx" ON "pm"."contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "installment_lines_installment_idx" ON "pm"."installment_lines" USING btree ("installment_id");--> statement-breakpoint
CREATE INDEX "installments_contract_idx" ON "pm"."installments" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "project_attachments_project_idx" ON "pm"."project_attachments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "psh_project_idx" ON "pm"."project_status_history" USING btree ("project_id","changed_at");--> statement-breakpoint
CREATE INDEX "psh_contract_idx" ON "pm"."project_status_history" USING btree ("contract_no","changed_at");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "pm"."projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_sale_code_idx" ON "pm"."projects" USING btree ("sale_code");--> statement-breakpoint
CREATE INDEX "projects_sml_code_idx" ON "pm"."projects" USING btree ("sml_code");--> statement-breakpoint
CREATE INDEX "surveys_project_idx" ON "pm"."surveys" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "quotation_lines_quotation_idx" ON "pm"."quotation_lines" USING btree ("quotation_id");--> statement-breakpoint
CREATE INDEX "quotations_project_idx" ON "pm"."quotations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "quotations_status_idx" ON "pm"."quotations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "material_request_lines_request_idx" ON "pm"."material_request_lines" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "material_requests_project_idx" ON "pm"."material_requests" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "material_requests_boq_idx" ON "pm"."material_requests" USING btree ("boq_id");--> statement-breakpoint
CREATE INDEX "material_requests_fulfilled_idx" ON "pm"."material_requests" USING btree ("fulfilled");--> statement-breakpoint
CREATE INDEX "technicians_code_idx" ON "pm"."technicians" USING btree ("code");--> statement-breakpoint
CREATE INDEX "work_order_checkins_wo_idx" ON "pm"."work_order_checkins" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_order_items_wo_idx" ON "pm"."work_order_items" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_order_logs_wo_idx" ON "pm"."work_order_logs" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_order_materials_wo_idx" ON "pm"."work_order_materials" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_order_tasks_wo_idx" ON "pm"."work_order_tasks" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_orders_project_idx" ON "pm"."work_orders" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "work_orders_status_idx" ON "pm"."work_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "work_schedule_project_idx" ON "pm"."work_schedule" USING btree ("project_id");