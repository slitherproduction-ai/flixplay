ALTER TABLE "Device" ADD COLUMN "proofAlgorithm" TEXT;
UPDATE "Device" SET "proofAlgorithm" = 'Ed25519' WHERE "proofPublicKey" IS NOT NULL;
