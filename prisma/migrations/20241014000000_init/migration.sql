-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'PREMIUM', 'ADMIN');

-- CreateEnum
CREATE TYPE "OddsFormat" AS ENUM ('AMERICAN', 'DECIMAL', 'FRACTIONAL');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "MarketType" AS ENUM ('MONEYLINE', 'SPREAD', 'TOTAL_OVER', 'TOTAL_UNDER', 'PLAYER_PROP', 'TEAM_PROP', 'FUTURES', 'LIVE');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'CONFIRMED', 'GUIDED', 'PLACED', 'CANCELLED', 'SETTLED');

-- CreateEnum
CREATE TYPE "BetResult" AS ENUM ('WIN', 'LOSS', 'PUSH', 'VOID');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "JobLogStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED', 'DELAYED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "auth0_sub" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "preferences" JSONB,
    "default_stake" DECIMAL(10,2),
    "preferred_odds_format" "OddsFormat" NOT NULL DEFAULT 'AMERICAN',
    "push_notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "expo_push_tokens" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sportsbooks" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "logo_url" TEXT,
    "deep_link_template" TEXT,
    "ios_scheme" TEXT,
    "android_package" TEXT,
    "web_url" TEXT,
    "supported_markets" TEXT[],
    "config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 999,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sportsbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sportsbook_links" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sportsbook_id" TEXT NOT NULL,
    "preference_order" INTEGER NOT NULL DEFAULT 999,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sportsbook_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "sport_type" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "home_team" TEXT NOT NULL,
    "away_team" TEXT NOT NULL,
    "home_team_canonical" TEXT,
    "away_team_canonical" TEXT,
    "external_ids" JSONB,
    "start_time" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "venue" TEXT,
    "season" TEXT,
    "week" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "market_type" "MarketType" NOT NULL,
    "parameters" JSONB,
    "market_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odds_snapshots" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "market_id" TEXT NOT NULL,
    "sportsbook_id" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "odds_american" INTEGER NOT NULL,
    "odds_decimal" DECIMAL(10,4) NOT NULL,
    "snapshot_hash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "sportsbook_id" TEXT NOT NULL,
    "selected_outcome" TEXT NOT NULL,
    "stake" DECIMAL(10,2) NOT NULL,
    "odds_american" INTEGER NOT NULL,
    "odds_decimal" DECIMAL(10,4) NOT NULL,
    "llm_recommendation" JSONB,
    "deep_link" TEXT,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "result" "BetResult",
    "settled_at" TIMESTAMP(3),
    "payout" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "guided_at" TIMESTAMP(3),

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "source_url" TEXT,
    "source_type" TEXT NOT NULL,
    "metadata" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "chunk_index" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_mappings" (
    "id" TEXT NOT NULL,
    "canonical_name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "aliases" JSONB NOT NULL,
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_logs" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "queue_name" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" "JobLogStatus" NOT NULL DEFAULT 'PENDING',
    "input_data" JSONB,
    "output_data" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet_types" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "bet_on" TEXT,
    "sides" INTEGER,
    "can_draw" BOOLEAN DEFAULT false,
    "has_points" BOOLEAN DEFAULT false,
    "selection_count" INTEGER,
    "bet_range" TEXT,
    "is_future" BOOLEAN DEFAULT false,
    "modified_on" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bet_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "team_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "abbreviation" TEXT,
    "league_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("team_id")
);

-- CreateTable
CREATE TABLE "players" (
    "player_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "team_id" TEXT,
    "league_id" TEXT,
    "position" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "market_sources" (
    "source_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_type" TEXT DEFAULT 'sportsbook',
    "logo_url" TEXT,
    "thumbnail_url" TEXT,
    "site_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status_id" INTEGER,
    "props_status_id" INTEGER,
    "futures_status_id" INTEGER,
    "source_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_sources_pkey" PRIMARY KEY ("source_id")
);

-- CreateTable
CREATE TABLE "unabated_events" (
    "event_id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3),
    "home_team_id" TEXT,
    "away_team_id" TEXT,
    "status" TEXT,
    "event_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unabated_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "market_lines" (
    "market_line_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "market_type" TEXT NOT NULL,
    "period_type" TEXT,
    "outcome" TEXT,
    "point" DOUBLE PRECISION,
    "price" INTEGER,
    "decimal_odds" DOUBLE PRECISION,
    "is_prop" BOOLEAN NOT NULL DEFAULT false,
    "player_id" TEXT,
    "bet_type_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_lines_pkey" PRIMARY KEY ("market_line_id")
);

-- CreateTable
CREATE TABLE "line_history" (
    "id" TEXT NOT NULL,
    "market_line_id" TEXT NOT NULL,
    "price_before" INTEGER,
    "price_after" INTEGER,
    "point_before" DOUBLE PRECISION,
    "point_after" DOUBLE PRECISION,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth0_sub_key" ON "users"("auth0_sub");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_auth0_sub_idx" ON "users"("auth0_sub");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sportsbooks_key_key" ON "sportsbooks"("key");

-- CreateIndex
CREATE INDEX "sportsbooks_key_idx" ON "sportsbooks"("key");

-- CreateIndex
CREATE INDEX "sportsbooks_is_active_idx" ON "sportsbooks"("is_active");

-- CreateIndex
CREATE INDEX "user_sportsbook_links_user_id_idx" ON "user_sportsbook_links"("user_id");

-- CreateIndex
CREATE INDEX "user_sportsbook_links_sportsbook_id_idx" ON "user_sportsbook_links"("sportsbook_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_sportsbook_links_user_id_sportsbook_id_key" ON "user_sportsbook_links"("user_id", "sportsbook_id");

-- CreateIndex
CREATE INDEX "events_sport_type_start_time_idx" ON "events"("sport_type", "start_time");

-- CreateIndex
CREATE INDEX "events_league_start_time_idx" ON "events"("league", "start_time");

-- CreateIndex
CREATE INDEX "events_start_time_idx" ON "events"("start_time");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE INDEX "markets_event_id_idx" ON "markets"("event_id");

-- CreateIndex
CREATE INDEX "markets_market_type_idx" ON "markets"("market_type");

-- CreateIndex
CREATE UNIQUE INDEX "markets_event_id_market_key_key" ON "markets"("event_id", "market_key");

-- CreateIndex
CREATE INDEX "odds_snapshots_market_id_sportsbook_id_idx" ON "odds_snapshots"("market_id", "sportsbook_id");

-- CreateIndex
CREATE INDEX "odds_snapshots_timestamp_idx" ON "odds_snapshots"("timestamp");

-- CreateIndex
CREATE INDEX "odds_snapshots_event_id_timestamp_idx" ON "odds_snapshots"("event_id", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "odds_snapshots_snapshot_hash_timestamp_key" ON "odds_snapshots"("snapshot_hash", "timestamp");

-- CreateIndex
CREATE INDEX "bets_user_id_created_at_idx" ON "bets"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "bets_status_idx" ON "bets"("status");

-- CreateIndex
CREATE INDEX "bets_event_id_idx" ON "bets"("event_id");

-- CreateIndex
CREATE INDEX "messages_user_id_conversation_id_created_at_idx" ON "messages"("user_id", "conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_source_type_idx" ON "documents"("source_type");

-- CreateIndex
CREATE INDEX "documents_is_active_idx" ON "documents"("is_active");

-- CreateIndex
CREATE INDEX "chunks_document_id_chunk_index_idx" ON "chunks"("document_id", "chunk_index");

-- CreateIndex
CREATE UNIQUE INDEX "team_mappings_canonical_name_key" ON "team_mappings"("canonical_name");

-- CreateIndex
CREATE INDEX "team_mappings_sport_league_idx" ON "team_mappings"("sport", "league");

-- CreateIndex
CREATE INDEX "idempotency_keys_user_id_idx" ON "idempotency_keys"("user_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE INDEX "job_logs_queue_name_status_idx" ON "job_logs"("queue_name", "status");

-- CreateIndex
CREATE INDEX "job_logs_job_id_idx" ON "job_logs"("job_id");

-- CreateIndex
CREATE INDEX "teams_league_id_idx" ON "teams"("league_id");

-- CreateIndex
CREATE INDEX "players_team_id_idx" ON "players"("team_id");

-- CreateIndex
CREATE INDEX "players_league_id_idx" ON "players"("league_id");

-- CreateIndex
CREATE INDEX "unabated_events_league_id_idx" ON "unabated_events"("league_id");

-- CreateIndex
CREATE INDEX "unabated_events_start_time_idx" ON "unabated_events"("start_time");

-- CreateIndex
CREATE INDEX "unabated_events_status_idx" ON "unabated_events"("status");

-- CreateIndex
CREATE INDEX "market_lines_event_id_idx" ON "market_lines"("event_id");

-- CreateIndex
CREATE INDEX "market_lines_source_id_idx" ON "market_lines"("source_id");

-- CreateIndex
CREATE INDEX "market_lines_market_type_idx" ON "market_lines"("market_type");

-- CreateIndex
CREATE INDEX "market_lines_updated_at_idx" ON "market_lines"("updated_at");

-- CreateIndex
CREATE INDEX "line_history_market_line_id_idx" ON "line_history"("market_line_id");

-- CreateIndex
CREATE INDEX "line_history_changed_at_idx" ON "line_history"("changed_at");

-- AddForeignKey
ALTER TABLE "user_sportsbook_links" ADD CONSTRAINT "user_sportsbook_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sportsbook_links" ADD CONSTRAINT "user_sportsbook_links_sportsbook_id_fkey" FOREIGN KEY ("sportsbook_id") REFERENCES "sportsbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_snapshots" ADD CONSTRAINT "odds_snapshots_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_snapshots" ADD CONSTRAINT "odds_snapshots_sportsbook_id_fkey" FOREIGN KEY ("sportsbook_id") REFERENCES "sportsbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_sportsbook_id_fkey" FOREIGN KEY ("sportsbook_id") REFERENCES "sportsbooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unabated_events" ADD CONSTRAINT "unabated_events_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("team_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unabated_events" ADD CONSTRAINT "unabated_events_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("team_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_lines" ADD CONSTRAINT "market_lines_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "unabated_events"("event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_lines" ADD CONSTRAINT "market_lines_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "market_sources"("source_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_lines" ADD CONSTRAINT "market_lines_bet_type_id_fkey" FOREIGN KEY ("bet_type_id") REFERENCES "bet_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_lines" ADD CONSTRAINT "market_lines_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("player_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_history" ADD CONSTRAINT "line_history_market_line_id_fkey" FOREIGN KEY ("market_line_id") REFERENCES "market_lines"("market_line_id") ON DELETE RESTRICT ON UPDATE CASCADE;

