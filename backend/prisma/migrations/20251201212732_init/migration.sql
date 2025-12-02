-- CreateEnum
CREATE TYPE "CarrierType" AS ENUM ('SEA_LINE', 'RAIL', 'AUTO', 'MULTIMODAL');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('EMAIL', 'EXCEL', 'API', 'MANUAL');

-- CreateEnum
CREATE TYPE "StatusCode" AS ENUM ('LOADED', 'IN_PORT', 'ON_SHIP', 'ON_ANCHORAGE', 'ARRIVED_PORT', 'ON_WAREHOUSE', 'CUSTOMS_CLEARED', 'ON_RAIL', 'RAIL_ARRIVED', 'ON_AUTO', 'DELIVERED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('IMPORT_EMAIL', 'IMPORT_TABLE', 'IMPORT_API', 'EXPORT_1C');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "carriers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CarrierType" NOT NULL,
    "contactEmail" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "inn" TEXT,
    "contactPerson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "containers" (
    "id" TEXT NOT NULL,
    "containerNumber" TEXT NOT NULL,
    "containerType" TEXT,
    "originPoint" TEXT,
    "destinationPoint" TEXT,
    "finalDestination" TEXT,
    "totalDistanceKm" INTEGER,
    "clientId" TEXT,
    "carrierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "containers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_events" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "statusCode" "StatusCode" NOT NULL,
    "statusText" TEXT NOT NULL,
    "location" TEXT,
    "distanceToDestinationKm" INTEGER,
    "eta" TIMESTAMP(3),
    "eventTime" TIMESTAMP(3) NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceRaw" TEXT,
    "rawMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_messages" (
    "id" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "content" TEXT NOT NULL,
    "senderEmail" TEXT,
    "subject" TEXT,
    "carrierId" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL,
    "type" "SyncJobType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "itemsTotal" INTEGER NOT NULL DEFAULT 0,
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorDetails" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "containers_containerNumber_key" ON "containers"("containerNumber");

-- CreateIndex
CREATE INDEX "containers_containerNumber_idx" ON "containers"("containerNumber");

-- CreateIndex
CREATE INDEX "status_events_containerId_idx" ON "status_events"("containerId");

-- CreateIndex
CREATE INDEX "status_events_eventTime_idx" ON "status_events"("eventTime");

-- CreateIndex
CREATE INDEX "raw_messages_processed_idx" ON "raw_messages"("processed");

-- CreateIndex
CREATE INDEX "raw_messages_createdAt_idx" ON "raw_messages"("createdAt");

-- CreateIndex
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs"("status");

-- CreateIndex
CREATE INDEX "sync_jobs_createdAt_idx" ON "sync_jobs"("createdAt");

-- AddForeignKey
ALTER TABLE "containers" ADD CONSTRAINT "containers_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "containers" ADD CONSTRAINT "containers_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_events" ADD CONSTRAINT "status_events_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "containers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_events" ADD CONSTRAINT "status_events_rawMessageId_fkey" FOREIGN KEY ("rawMessageId") REFERENCES "raw_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_messages" ADD CONSTRAINT "raw_messages_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
