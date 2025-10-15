-- AlterTable
ALTER TABLE "market_lines" ADD COLUMN     "bet_sub_type" TEXT;

-- CreateIndex
CREATE INDEX "market_lines_player_id_idx" ON "market_lines"("player_id");
