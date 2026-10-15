CREATE TABLE "AdminMfaCredential" (
 "userId" UUID NOT NULL,
 "secretCipher" TEXT NOT NULL,
 "lastUsedStep" BIGINT NOT NULL DEFAULT -1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AdminMfaCredential_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "AdminMfaCredential" ADD CONSTRAINT "AdminMfaCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
