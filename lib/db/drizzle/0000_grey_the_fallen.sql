CREATE TABLE "ad_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"advertiser_name" text NOT NULL,
	"contact_person" text,
	"phone" text NOT NULL,
	"email" text,
	"ad_title" text NOT NULL,
	"subtitle" text,
	"image_url" text NOT NULL,
	"target_url" text,
	"days_requested" integer DEFAULT 1 NOT NULL,
	"cost_npr" integer DEFAULT 500 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"created_at" text NOT NULL,
	"start_date" text,
	"end_date" text
);
--> statement-breakpoint
CREATE TABLE "advertisements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"image_url" text NOT NULL,
	"target_url" text,
	"tenant_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"date" date DEFAULT now() NOT NULL,
	"bus_status" text DEFAULT 'PENDING' NOT NULL,
	"class_status" text DEFAULT 'PENDING' NOT NULL,
	"marked_by_driver" boolean DEFAULT false NOT NULL,
	"marked_by_teacher" boolean DEFAULT false NOT NULL,
	CONSTRAINT "attendance_records_student_id_date_unique" UNIQUE("student_id","date")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" integer,
	"full_name" text NOT NULL,
	"photo_url" text,
	"class_name" text,
	"section" text,
	"station_name" text,
	"parent_id" uuid
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'event' NOT NULL,
	"event_date" text NOT NULL,
	"notified" boolean DEFAULT false NOT NULL,
	"auto_notify" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"vehicle_id" integer,
	"date" text NOT NULL,
	"liters" real NOT NULL,
	"amount_npr" integer NOT NULL,
	"odometer_km" integer NOT NULL,
	"receipt_url" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"vehicle_id" integer,
	"part_type" text NOT NULL,
	"description" text,
	"cost_npr" integer DEFAULT 0 NOT NULL,
	"odometer_km" integer NOT NULL,
	"service_date" text NOT NULL,
	"vendor" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"vehicle_id" integer NOT NULL,
	"bluebook_expiry" text,
	"insurance_expiry" text,
	"pollution_expiry" text,
	"bluebook_photo_url" text,
	"engine_number" text,
	"chassis_number" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_documents_vehicle_unique" UNIQUE("vehicle_id")
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"photo_url" text,
	"gender" text,
	"vehicle_number" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"current_lat" real,
	"current_lng" real,
	"location_updated_at" text,
	"speed_kmh" real,
	"trip_started_at" timestamp,
	"trip_completed_at" timestamp,
	"delay_alert_sent_at" timestamp,
	"active_session_id" text,
	"unfrozen_at" timestamp,
	"email" text,
	CONSTRAINT "drivers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "route_stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"route_id" integer NOT NULL,
	"station_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"direction" text DEFAULT 'forward' NOT NULL,
	"stop_label" text
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" text NOT NULL,
	"driver_id" integer,
	"vehicle_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"departure_time" text DEFAULT '06:00 AM' NOT NULL,
	"avg_speed_kmh" integer DEFAULT 25 NOT NULL,
	"return_in_same_route" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" text NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"radius" integer DEFAULT 200 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"driver_id" integer,
	"driver_name" text,
	"vehicle_number" text,
	"route_id" integer,
	"route_name" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"passengers_total" integer DEFAULT 0 NOT NULL,
	"passengers_boarded" integer DEFAULT 0 NOT NULL,
	"boarded_passenger_ids" integer[] DEFAULT '{}' NOT NULL,
	"station_logs" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"plate_number" text NOT NULL,
	"model" text NOT NULL,
	"capacity" integer DEFAULT 40 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"tag" text,
	"current_stop_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gps_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"driver_id" integer NOT NULL,
	"trip_id" integer,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"speed" real,
	"heading" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"landline" text NOT NULL,
	"email" text NOT NULL,
	"admin_name" text NOT NULL,
	"position" text NOT NULL,
	"mobile" text NOT NULL,
	"status" text DEFAULT 'pending_super_admin_approval' NOT NULL,
	"school_code" text,
	"tenant_id" integer,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"message" text NOT NULL,
	"message_ne" text,
	"severity" text DEFAULT 'info' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"fuel_budget_npr" real DEFAULT 0 NOT NULL,
	"maint_budget_npr" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"banner_url" text,
	"address" text,
	"contact_phone" text,
	"email" text,
	"website_url" text,
	"facebook_url" text,
	"tiktok_url" text,
	"instagram_url" text,
	"youtube_url" text,
	"school_code" text,
	"currency" text DEFAULT 'NPR' NOT NULL,
	"country" text DEFAULT 'NP' NOT NULL,
	"calendar_system" text DEFAULT 'bs' NOT NULL,
	"subscription_tier" text DEFAULT 'gold' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_school_code_unique" UNIQUE("school_code")
);
--> statement-breakpoint
CREATE TABLE "boarding_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"passenger_id" integer NOT NULL,
	"passenger_name" text NOT NULL,
	"station_id" integer NOT NULL,
	"station_name" text NOT NULL,
	"driver_id" integer,
	"driver_name" text,
	"action" text NOT NULL,
	"action_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"passenger_id" integer NOT NULL,
	"passenger_name" text NOT NULL,
	"station_id" integer NOT NULL,
	"station_name" text NOT NULL,
	"driver_id" integer,
	"driver_name" text,
	"message" text DEFAULT 'Driver is waiting for you. Please come to the station.' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trip_date" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"passenger_id" integer,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passengers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"photo_url" text,
	"role" text DEFAULT 'student' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"station_id" integer NOT NULL,
	"route_id" integer,
	"boarded_at" timestamp,
	"live_today" integer DEFAULT 0 NOT NULL,
	"quick_message" text,
	"class_name" text,
	"custom_class" text,
	"section" text,
	"roll_number" text,
	"faculty" text,
	"designation" text,
	"parent_name" text,
	"gender" text,
	"live_date" text,
	"route_subscribed_at" timestamp,
	"proximity_alert_sent_at" timestamp,
	"email" text
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"passenger_id" integer NOT NULL,
	"token" text NOT NULL,
	"provider" text DEFAULT 'expo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"user_role" text DEFAULT 'admin' NOT NULL,
	"tier" text DEFAULT 'trial' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"photo_url" text,
	"role" text DEFAULT 'student' NOT NULL,
	"school_code" text,
	"tenant_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"password_hash" text,
	"biometric_enabled" boolean DEFAULT false NOT NULL,
	"biometric_credential_id" text,
	"biometric_public_key" text,
	"biometric_counter" integer DEFAULT 0,
	"active_session_id" text,
	"is_class_teacher" boolean DEFAULT false NOT NULL,
	"assigned_class" text,
	"assigned_section" text,
	"designation" text,
	"email" text,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "webauthn_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge" text NOT NULL,
	"user_id" integer,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webauthn_challenges_challenge_unique" UNIQUE("challenge")
);
--> statement-breakpoint
CREATE TABLE "vehicle_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer NOT NULL,
	"plate_number" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"speed" real,
	"heading" real,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_locations_vehicle_id_unique" UNIQUE("vehicle_id")
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stations" ADD CONSTRAINT "route_stations_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stations" ADD CONSTRAINT "route_stations_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stations" ADD CONSTRAINT "stations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_logs" ADD CONSTRAINT "trip_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_logs" ADD CONSTRAINT "trip_logs_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_logs" ADD CONSTRAINT "trip_logs_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_logs" ADD CONSTRAINT "gps_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_logs" ADD CONSTRAINT "gps_logs_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_logs" ADD CONSTRAINT "gps_logs_trip_id_trip_logs_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_settings" ADD CONSTRAINT "budget_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boarding_logs" ADD CONSTRAINT "boarding_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_notifications" ADD CONSTRAINT "driver_notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_locations" ADD CONSTRAINT "vehicle_locations_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "push_tokens_passenger_token_unique" ON "push_tokens" USING btree ("passenger_id","token");