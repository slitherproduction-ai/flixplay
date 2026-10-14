ALTER TABLE "Device" ADD COLUMN "proofPublicKey" TEXT;
CREATE TABLE "DeviceProofChallenge" (
  "id" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceProofChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeviceProofChallenge_nonceHash_key" ON "DeviceProofChallenge"("nonceHash");
CREATE INDEX "DeviceProofChallenge_deviceId_expiresAt_idx" ON "DeviceProofChallenge"("deviceId", "expiresAt");
ALTER TABLE "DeviceProofChallenge" ADD CONSTRAINT "DeviceProofChallenge_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
