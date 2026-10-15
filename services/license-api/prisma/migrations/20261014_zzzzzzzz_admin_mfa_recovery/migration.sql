CREATE TABLE "AdminMfaRecoveryRequest" (
"id" UUID NOT NULL, "targetUserId" UUID NOT NULL, "initiatedById" UUID NOT NULL,
"approvedById" UUID, "evidenceReference" TEXT NOT NULL,
"status" TEXT NOT NULL DEFAULT 'PENDING',
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"approvedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "AdminMfaRecoveryRequest_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AdminMfaRecoveryRequest_targetUserId_status_idx"
ON "AdminMfaRecoveryRequest"("targetUserId", "status");
