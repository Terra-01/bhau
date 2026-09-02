-- CreateTable
CREATE TABLE "TvStream" (
    "channelId" TEXT NOT NULL,
    "videoId" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TvStream_pkey" PRIMARY KEY ("channelId")
);
