CREATE TABLE "AdminMutationReceipt" (
  "id" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "requestKey" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "targetId" UUID NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminMutationReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminMutationReceipt_requestKey_key" ON "AdminMutationReceipt"("requestKey");
CREATE INDEX "AdminMutationReceipt_actorId_createdAt_idx" ON "AdminMutationReceipt"("actorId", "createdAt");
