-- CreateEnum
CREATE TYPE "QuickExamJobStatus" AS ENUM ('pending', 'running', 'success', 'failed');

-- CreateTable
CREATE TABLE "QuickExamReportJob" (
    "id" TEXT NOT NULL,
    "checkupId" TEXT NOT NULL,
    "status" "QuickExamJobStatus" NOT NULL DEFAULT 'pending',
    "mode" TEXT NOT NULL DEFAULT 'async_chunk',
    "progressJson" JSONB NOT NULL DEFAULT '{}',
    "reportText" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickExamReportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuickExamReportJob_checkupId_createdAt_idx" ON "QuickExamReportJob"("checkupId", "createdAt");

-- AddForeignKey
ALTER TABLE "QuickExamReportJob" ADD CONSTRAINT "QuickExamReportJob_checkupId_fkey" FOREIGN KEY ("checkupId") REFERENCES "Checkup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
