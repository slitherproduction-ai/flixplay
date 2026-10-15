ALTER TABLE "AdminMfaRecoveryRequest" ADD COLUMN "grantHash" TEXT, ADD COLUMN "grantExpiresAt" TIMESTAMP(3), ADD COLUMN "grantConsumedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "AdminMfaRecoveryRequest_grantHash_key" ON "AdminMfaRecoveryRequest"("grantHash");
