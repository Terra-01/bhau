-- CreateTable
CREATE TABLE "LedgerEntry" (
    "seq" SERIAL NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "AgentState" (
    "id" TEXT NOT NULL,
    "cash" DOUBLE PRECISION NOT NULL,
    "positions" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquitySnapshot" (
    "date" DATE NOT NULL,
    "agentId" TEXT NOT NULL,
    "equity" DOUBLE PRECISION NOT NULL,
    "cash" DOUBLE PRECISION NOT NULL,
    "positionsValue" DOUBLE PRECISION NOT NULL,
    "totalReturnPct" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquitySnapshot_pkey" PRIMARY KEY ("date","agentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_hash_key" ON "LedgerEntry"("hash");

-- CreateIndex
CREATE INDEX "LedgerEntry_agentId_seq_idx" ON "LedgerEntry"("agentId", "seq");

-- CreateIndex
CREATE INDEX "EquitySnapshot_agentId_date_idx" ON "EquitySnapshot"("agentId", "date");
