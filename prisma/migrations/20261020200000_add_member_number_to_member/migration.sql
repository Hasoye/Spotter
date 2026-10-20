-- AlterTable
ALTER TABLE "Member" ADD COLUMN "memberNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Member_memberNumber_key" ON "Member"("memberNumber");
