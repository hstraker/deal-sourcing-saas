-- CreateTable: sourcing_alerts
CREATE TABLE "sourcing_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT NOT NULL,
    "radius" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "min_price" INTEGER,
    "max_price" INTEGER,
    "min_bedrooms" INTEGER,
    "max_bedrooms" INTEGER,
    "property_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sourcing_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: alert_matches
CREATE TABLE "alert_matches" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "scraped_property_id" TEXT NOT NULL,
    "matched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_email" BOOLEAN NOT NULL DEFAULT false,
    "notified_sms" BOOLEAN NOT NULL DEFAULT false,
    "notified_in_app" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "alert_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notification_preferences
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "price_increase" BOOLEAN NOT NULL DEFAULT true,
    "price_decrease" BOOLEAN NOT NULL DEFAULT true,
    "auction_reminder_7_days" BOOLEAN NOT NULL DEFAULT true,
    "auction_reminder_3_days" BOOLEAN NOT NULL DEFAULT true,
    "auction_reminder_1_day" BOOLEAN NOT NULL DEFAULT true,
    "new_property_match" BOOLEAN NOT NULL DEFAULT true,
    "delivery_email" BOOLEAN NOT NULL DEFAULT true,
    "delivery_sms" BOOLEAN NOT NULL DEFAULT false,
    "delivery_in_app" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable: watchlist_properties
CREATE TABLE "watchlist_properties" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scraped_property_id" TEXT NOT NULL,
    "last_known_price" INTEGER NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sourcing_alerts_user_id_idx" ON "sourcing_alerts"("user_id");
CREATE INDEX "sourcing_alerts_is_active_idx" ON "sourcing_alerts"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "alert_matches_alert_id_scraped_property_id_key" ON "alert_matches"("alert_id", "scraped_property_id");
CREATE INDEX "alert_matches_alert_id_idx" ON "alert_matches"("alert_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "watchlist_properties_user_id_scraped_property_id_key" ON "watchlist_properties"("user_id", "scraped_property_id");
CREATE INDEX "watchlist_properties_user_id_idx" ON "watchlist_properties"("user_id");

-- AddForeignKey
ALTER TABLE "sourcing_alerts" ADD CONSTRAINT "sourcing_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_matches" ADD CONSTRAINT "alert_matches_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "sourcing_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_matches" ADD CONSTRAINT "alert_matches_scraped_property_id_fkey" FOREIGN KEY ("scraped_property_id") REFERENCES "property_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_properties" ADD CONSTRAINT "watchlist_properties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_properties" ADD CONSTRAINT "watchlist_properties_scraped_property_id_fkey" FOREIGN KEY ("scraped_property_id") REFERENCES "property_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
