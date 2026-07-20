-- CreateTable
CREATE TABLE "VoteAttempt" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoteAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoteAttempt_ipHash_createdAt_idx" ON "VoteAttempt"("ipHash", "createdAt");
