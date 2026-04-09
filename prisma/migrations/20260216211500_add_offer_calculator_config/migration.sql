-- AlterTable
ALTER TABLE "vendor_leads" ADD COLUMN     "chain_status" TEXT,
ADD COLUMN     "investment_strategy" TEXT,
ADD COLUMN     "postcode_demand_score" INTEGER,
ADD COLUMN     "tenure_type" TEXT;

-- CreateTable
CREATE TABLE "offer_calculator_config" (
    "id" TEXT NOT NULL,
    "enable_strategy_mode" BOOLEAN NOT NULL DEFAULT false,
    "active_strategies" TEXT[] DEFAULT ARRAY['BuyHold', 'BTL']::TEXT[],
    "default_strategy" TEXT NOT NULL DEFAULT 'BuyHold',
    "base_discount_min" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "base_discount_max" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "poor_condition_discount" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "avg_condition_discount" DECIMAL(5,2) NOT NULL DEFAULT 3,
    "leasehold_discount" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "long_chain_discount" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "short_chain_discount" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "high_demand_threshold" INTEGER NOT NULL DEFAULT 8,
    "high_demand_reduction" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "flip_market_value_pct" DECIMAL(5,2) NOT NULL DEFAULT 70,
    "brr_ltv_percent" DECIMAL(5,2) NOT NULL DEFAULT 75,
    "buy_hold_min_yield" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "btl_min_yield" DECIMAL(5,2) NOT NULL DEFAULT 7,
    "min_bmv_percentage" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "min_profit_potential" DECIMAL(12,2) NOT NULL DEFAULT 10000,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_calculator_config_pkey" PRIMARY KEY ("id")
);
