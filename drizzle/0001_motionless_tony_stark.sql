CREATE TABLE "pm"."project_tasks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"legacy_id" integer,
	"project_id" bigint,
	"legacy_contract_ref" text,
	"task_code" text,
	"title" text NOT NULL,
	"phase" text,
	"technician_code" text,
	"technician_name" text,
	"planned_start" date,
	"planned_end" date,
	"est_days" numeric(10, 2) DEFAULT '0' NOT NULL,
	"est_hours" numeric(10, 2) DEFAULT '0' NOT NULL,
	"actual_hours" numeric(10, 2) DEFAULT '0' NOT NULL,
	"work_order_id" bigint,
	"status" text DEFAULT 'planned' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_tasks_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
ALTER TABLE "pm"."work_orders" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "pm"."work_orders" ADD COLUMN "work_date" date;--> statement-breakpoint
ALTER TABLE "pm"."work_orders" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "pm"."work_orders" ADD COLUMN "rate_per_hour" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "pm"."work_orders" ADD COLUMN "total_hours" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "pm"."work_orders" ADD COLUMN "labor_cost" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "pm"."project_tasks" ADD CONSTRAINT "project_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "pm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm"."project_tasks" ADD CONSTRAINT "project_tasks_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "pm"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_tasks_project_idx" ON "pm"."project_tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_tasks_work_order_idx" ON "pm"."project_tasks" USING btree ("work_order_id");--> statement-breakpoint
ALTER TABLE "pm"."work_orders" ADD CONSTRAINT "work_orders_legacy_id_unique" UNIQUE("legacy_id");