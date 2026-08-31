-- CreateTable
CREATE TABLE "FlowDaily" (
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "buy" DOUBLE PRECISION NOT NULL,
    "sell" DOUBLE PRECISION NOT NULL,
    "net" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlowDaily_pkey" PRIMARY KEY ("date","category")
);
