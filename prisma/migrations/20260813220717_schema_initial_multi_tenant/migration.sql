-- ---------------------------------------------------------------------------
-- Extensions requises.
--
-- postgis    : géométrie et calculs de proximité sur les adresses.
-- btree_gist : permet de combiner égalité et chevauchement d'intervalles dans
--              une même contrainte d'exclusion — c'est ce qui rend possible le
--              verrou anti-double-réservation posé plus bas.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('MARKETPLACE', 'COMPANY', 'INDEPENDENT');

-- CreateEnum
CREATE TYPE "EngagementMode" AS ENUM ('PRESTATAIRE', 'MANDATAIRE');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLATFORM_ADMIN', 'ORG_OWNER', 'ORG_MANAGER', 'CLEANER', 'CLIENT');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CleanerStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('INDEPENDENT', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('SIRET', 'INSURANCE_RC_PRO', 'IDENTITY', 'BANK_DETAILS');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ServiceKind" AS ENUM ('MENAGE_REGULIER', 'GRAND_MENAGE', 'REPASSAGE', 'VITRES', 'FIN_DE_BAIL');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('ONE_OFF', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'PENDING_ASSIGNMENT', 'ASSIGNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_CLEANER', 'NO_SHOW', 'DISPUTED');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('LEOCLEAN', 'ORG_PAGE', 'BACK_OFFICE');

-- CreateEnum
CREATE TYPE "BookingItemKind" AS ENUM ('SERVICE', 'OPTION');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AvailabilityExceptionType" AS ENUM ('UNAVAILABLE', 'AVAILABLE');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE', 'MICROSOFT', 'ICAL');

-- CreateEnum
CREATE TYPE "CalendarConnectionStatus" AS ENUM ('HEALTHY', 'NEEDS_RECONSENT', 'ERROR', 'REVOKED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('REQUIRES_CAPTURE', 'CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('CLIENT_SERVICE', 'PLATFORM_COMMISSION', 'ORG_SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'LOST');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PENDING',
    "engagementMode" "EngagementMode" NOT NULL DEFAULT 'PRESTATAIRE',
    "commissionRateBp" INTEGER NOT NULL DEFAULT 2500,
    "isPubliclyBookable" BOOLEAN NOT NULL DEFAULT false,
    "tagline" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "publicPhone" TEXT,
    "publicEmail" TEXT,
    "legalName" TEXT,
    "siret" TEXT,
    "sapDeclarationNumber" TEXT,
    "insuranceExpiresAt" TIMESTAMP(3),
    "stripeAccountId" TEXT,
    "stripeCustomerId" TEXT,
    "subscriptionPlan" TEXT,
    "subscriptionStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "invitedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "ClientProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "accessNotes" TEXT,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanerProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "photoUrl" TEXT,
    "status" "CleanerStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'INDEPENDENT',
    "siret" TEXT,
    "insuranceExpiresAt" TIMESTAMP(3),
    "stripeAccountId" TEXT,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "homeAddressId" TEXT,
    "maxTravelMinutes" INTEGER NOT NULL DEFAULT 30,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "acceptanceRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CleanerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanerDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cleanerProfileId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "fileUrl" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CleanerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientProfileId" TEXT,
    "label" TEXT,
    "street" TEXT NOT NULL,
    "complement" TEXT,
    "postalCode" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "inseeCode" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "banId" TEXT,
    "accessNotes" TEXT,
    "floor" TEXT,
    "hasElevator" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ServiceKind" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sqmPerHour" INTEGER NOT NULL DEFAULT 25,
    "minDurationMinutes" INTEGER NOT NULL DEFAULT 120,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOption" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "extraMinutes" INTEGER NOT NULL DEFAULT 30,
    "extraPriceCents" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "frequency" "Frequency" NOT NULL,
    "hourlyRateCents" INTEGER NOT NULL,
    "taxCreditRateBp" INTEGER NOT NULL DEFAULT 5000,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientProfileId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "BookingSource" NOT NULL DEFAULT 'LEOCLEAN',
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "surfaceSqm" INTEGER,
    "frequency" "Frequency" NOT NULL DEFAULT 'ONE_OFF',
    "engagementMode" "EngagementMode" NOT NULL DEFAULT 'PRESTATAIRE',
    "hourlyRateCents" INTEGER NOT NULL,
    "grossAmountCents" INTEGER NOT NULL,
    "taxCreditRateBp" INTEGER NOT NULL DEFAULT 5000,
    "taxCreditAmountCents" INTEGER NOT NULL,
    "netAmountCents" INTEGER NOT NULL,
    "commissionRateBp" INTEGER NOT NULL,
    "commissionAmountCents" INTEGER NOT NULL,
    "cancellationFeeCents" INTEGER NOT NULL DEFAULT 0,
    "clientNotes" TEXT,
    "internalNotes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" "BookingItemKind" NOT NULL,
    "sourceId" TEXT,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "extraMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingStatusEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus" NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientProfileId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "frequency" "Frequency" NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "weekOfMonth" INTEGER,
    "anchorDate" TIMESTAMP(3) NOT NULL,
    "preferredCleanerId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "pausedUntil" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cleanerProfileId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cleanerProfileId" TEXT NOT NULL,
    "type" "AvailabilityExceptionType" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cleanerProfileId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "status" "CalendarConnectionStatus" NOT NULL DEFAULT 'HEALTHY',
    "externalAccountEmail" TEXT,
    "externalCalendarId" TEXT,
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "syncCursor" TEXT,
    "pushChannelId" TEXT,
    "pushResourceId" TEXT,
    "pushExpiresAt" TIMESTAMP(3),
    "writeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalBusyBlock" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cleanerProfileId" TEXT NOT NULL,
    "calendarConnectionId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "externalEventId" TEXT NOT NULL,
    "recurringEventId" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalBusyBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "cleanerProfileId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PROPOSED',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "blockStartAt" TIMESTAMP(3) NOT NULL,
    "blockEndAt" TIMESTAMP(3) NOT NULL,
    "travelMinutesBefore" INTEGER NOT NULL DEFAULT 0,
    "travelMinutesAfter" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION,
    "scoreBreakdown" JSONB,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondBy" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "isReplacement" BOOLEAN NOT NULL DEFAULT false,
    "replacedAssignmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'REQUIRES_CAPTURE',
    "stripePaymentIntentId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "capturedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "authorizedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cleanerProfileId" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "stripeTransferId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT,
    "subscriptionId" TEXT,
    "type" "InvoiceType" NOT NULL,
    "number" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCents" INTEGER NOT NULL,
    "taxCreditEligibleCents" INTEGER NOT NULL DEFAULT 0,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "clientProfileId" TEXT NOT NULL,
    "cleanerProfileId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "communeInsee" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "reply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bookingId" TEXT,
    "senderUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "communeInsee" TEXT,
    "message" TEXT,
    "sourcePath" TEXT,
    "contactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelTimeCache" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "originKey" TEXT NOT NULL,
    "destKey" TEXT NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "destLat" DOUBLE PRECISION NOT NULL,
    "destLng" DOUBLE PRECISION NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "TravelTimeCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_type_status_idx" ON "Organization"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_organizationId_role_status_idx" ON "Membership"("organizationId", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "ClientProfile_organizationId_idx" ON "ClientProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientProfile_organizationId_userId_key" ON "ClientProfile"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CleanerProfile_homeAddressId_key" ON "CleanerProfile"("homeAddressId");

-- CreateIndex
CREATE INDEX "CleanerProfile_organizationId_status_idx" ON "CleanerProfile"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CleanerProfile_organizationId_userId_key" ON "CleanerProfile"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "CleanerDocument_organizationId_status_idx" ON "CleanerDocument"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CleanerDocument_cleanerProfileId_type_key" ON "CleanerDocument"("cleanerProfileId", "type");

-- CreateIndex
CREATE INDEX "Address_organizationId_idx" ON "Address"("organizationId");

-- CreateIndex
CREATE INDEX "Address_inseeCode_idx" ON "Address"("inseeCode");

-- CreateIndex
CREATE INDEX "Service_organizationId_isActive_idx" ON "Service"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Service_organizationId_slug_key" ON "Service"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "ServiceOption_serviceId_isActive_idx" ON "ServiceOption"("serviceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOption_organizationId_slug_key" ON "ServiceOption"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "PricingRule_organizationId_serviceId_frequency_validFrom_idx" ON "PricingRule"("organizationId", "serviceId", "frequency", "validFrom");

-- CreateIndex
CREATE INDEX "Booking_organizationId_status_scheduledStart_idx" ON "Booking"("organizationId", "status", "scheduledStart");

-- CreateIndex
CREATE INDEX "Booking_organizationId_clientProfileId_idx" ON "Booking"("organizationId", "clientProfileId");

-- CreateIndex
CREATE INDEX "Booking_scheduledStart_idx" ON "Booking"("scheduledStart");

-- CreateIndex
CREATE INDEX "BookingItem_bookingId_idx" ON "BookingItem"("bookingId");

-- CreateIndex
CREATE INDEX "BookingStatusEvent_bookingId_createdAt_idx" ON "BookingStatusEvent"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "Subscription_organizationId_status_idx" ON "Subscription"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AvailabilityRule_cleanerProfileId_weekday_idx" ON "AvailabilityRule"("cleanerProfileId", "weekday");

-- CreateIndex
CREATE INDEX "AvailabilityException_cleanerProfileId_startAt_endAt_idx" ON "AvailabilityException"("cleanerProfileId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "CalendarConnection_organizationId_status_idx" ON "CalendarConnection"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CalendarConnection_pushExpiresAt_idx" ON "CalendarConnection"("pushExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_cleanerProfileId_provider_externalCalend_key" ON "CalendarConnection"("cleanerProfileId", "provider", "externalCalendarId");

-- CreateIndex
CREATE INDEX "ExternalBusyBlock_cleanerProfileId_startAt_endAt_idx" ON "ExternalBusyBlock"("cleanerProfileId", "startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalBusyBlock_calendarConnectionId_externalEventId_key" ON "ExternalBusyBlock"("calendarConnectionId", "externalEventId");

-- CreateIndex
CREATE INDEX "Assignment_organizationId_status_idx" ON "Assignment"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Assignment_cleanerProfileId_startAt_idx" ON "Assignment"("cleanerProfileId", "startAt");

-- CreateIndex
CREATE INDEX "Assignment_bookingId_status_idx" ON "Assignment"("bookingId", "status");

-- CreateIndex
CREATE INDEX "Assignment_respondBy_idx" ON "Assignment"("respondBy");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_status_idx" ON "Payment"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_stripeTransferId_key" ON "Payout"("stripeTransferId");

-- CreateIndex
CREATE INDEX "Payout_organizationId_status_idx" ON "Payout"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Payout_cleanerProfileId_periodStart_idx" ON "Payout"("cleanerProfileId", "periodStart");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_issuedAt_idx" ON "Invoice"("organizationId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_number_key" ON "Invoice"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE INDEX "Review_organizationId_isPublic_publishedAt_idx" ON "Review"("organizationId", "isPublic", "publishedAt");

-- CreateIndex
CREATE INDEX "Review_communeInsee_isPublic_idx" ON "Review"("communeInsee", "isPublic");

-- CreateIndex
CREATE INDEX "Review_cleanerProfileId_idx" ON "Review"("cleanerProfileId");

-- CreateIndex
CREATE INDEX "Message_organizationId_recipientUserId_readAt_idx" ON "Message"("organizationId", "recipientUserId", "readAt");

-- CreateIndex
CREATE INDEX "Message_bookingId_createdAt_idx" ON "Message"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_organizationId_status_createdAt_idx" ON "Lead"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TravelTimeCache_expiresAt_idx" ON "TravelTimeCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TravelTimeCache_provider_originKey_destKey_key" ON "TravelTimeCache"("provider", "originKey", "destKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_processedAt_idx" ON "WebhookEvent"("provider", "processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_externalId_key" ON "WebhookEvent"("provider", "externalId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanerProfile" ADD CONSTRAINT "CleanerProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanerProfile" ADD CONSTRAINT "CleanerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanerProfile" ADD CONSTRAINT "CleanerProfile_homeAddressId_fkey" FOREIGN KEY ("homeAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanerDocument" ADD CONSTRAINT "CleanerDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanerDocument" ADD CONSTRAINT "CleanerDocument_cleanerProfileId_fkey" FOREIGN KEY ("cleanerProfileId") REFERENCES "CleanerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanerDocument" ADD CONSTRAINT "CleanerDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOption" ADD CONSTRAINT "ServiceOption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOption" ADD CONSTRAINT "ServiceOption_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingStatusEvent" ADD CONSTRAINT "BookingStatusEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingStatusEvent" ADD CONSTRAINT "BookingStatusEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_preferredCleanerId_fkey" FOREIGN KEY ("preferredCleanerId") REFERENCES "CleanerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_cleanerProfileId_fkey" FOREIGN KEY ("cleanerProfileId") REFERENCES "CleanerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityException" ADD CONSTRAINT "AvailabilityException_cleanerProfileId_fkey" FOREIGN KEY ("cleanerProfileId") REFERENCES "CleanerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_cleanerProfileId_fkey" FOREIGN KEY ("cleanerProfileId") REFERENCES "CleanerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalBusyBlock" ADD CONSTRAINT "ExternalBusyBlock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalBusyBlock" ADD CONSTRAINT "ExternalBusyBlock_cleanerProfileId_fkey" FOREIGN KEY ("cleanerProfileId") REFERENCES "CleanerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalBusyBlock" ADD CONSTRAINT "ExternalBusyBlock_calendarConnectionId_fkey" FOREIGN KEY ("calendarConnectionId") REFERENCES "CalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_cleanerProfileId_fkey" FOREIGN KEY ("cleanerProfileId") REFERENCES "CleanerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_cleanerProfileId_fkey" FOREIGN KEY ("cleanerProfileId") REFERENCES "CleanerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_cleanerProfileId_fkey" FOREIGN KEY ("cleanerProfileId") REFERENCES "CleanerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Géographie des adresses.
--
-- `geog` est une colonne générée : elle dérive de lat/lng et ne peut donc pas
-- en diverger, contrairement à ce qu'un déclencheur ou une écriture applicative
-- laisserait arriver. Le type `geography` calcule sur l'ellipsoïde, ce qui
-- évite d'avoir à choisir une projection locale.
--
-- Attention à l'ordre des arguments : ST_MakePoint attend (longitude, latitude).
-- ---------------------------------------------------------------------------
ALTER TABLE "Address"
  ADD COLUMN "geog" geography(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography) STORED;

CREATE INDEX "Address_geog_idx" ON "Address" USING GIST ("geog");

-- ---------------------------------------------------------------------------
-- Verrou anti-double-réservation.
--
-- Deux affectations vivantes du même intervenant ne peuvent pas se chevaucher.
-- La comparaison ne porte pas sur le créneau de la prestation mais sur
-- `blockStartAt`/`blockEndAt`, qui l'étendent des temps de trajet : sur un
-- territoire semi-rural, réserver deux ménages jointifs à quinze kilomètres
-- l'un de l'autre serait accepté par un simple contrôle de créneau et
-- infaisable dans la réalité.
--
-- La contrainte est portée par la base, pas par le code : deux requêtes
-- concurrentes qui passeraient toutes deux un contrôle applicatif échouent ici.
-- Les statuts terminaux (refusée, expirée, annulée, terminée) sont exclus du
-- filtre, sans quoi l'historique bloquerait les créneaux à jamais.
--
-- L'intervalle est semi-ouvert : une mission qui finit à 10 h 00 et une autre
-- qui commence à 10 h 00 ne se chevauchent pas.
--
-- On emploie `tsrange` et non `tstzrange` : Prisma projette DateTime sur
-- `timestamp without time zone` et y écrit de l'UTC. Convertir vers
-- `timestamptz` dépendrait du paramètre TimeZone de la session, ce qui n'est
-- pas immutable et donc interdit dans une expression d'index.
-- ---------------------------------------------------------------------------
ALTER TABLE "Assignment"
  ADD CONSTRAINT "Assignment_no_overlap"
  EXCLUDE USING GIST (
    "cleanerProfileId" WITH =,
    tsrange("blockStartAt", "blockEndAt", '[)') WITH &&
  )
  WHERE ("status" IN ('PROPOSED', 'ACCEPTED'));

-- ---------------------------------------------------------------------------
-- Une seule affectation acceptée par réservation.
--
-- La contrainte d'exclusion ci-dessus empêche un intervenant d'être à deux
-- endroits ; celle-ci empêche une réservation d'avoir deux intervenants.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "Assignment_one_accepted_per_booking"
  ON "Assignment" ("bookingId")
  WHERE ("status" = 'ACCEPTED');

-- ---------------------------------------------------------------------------
-- Cohérence des créneaux : une fin ne peut pas précéder un début.
-- ---------------------------------------------------------------------------
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_schedule_ordered" CHECK ("scheduledEnd" > "scheduledStart");

ALTER TABLE "Assignment"
  ADD CONSTRAINT "Assignment_schedule_ordered" CHECK ("endAt" > "startAt"),
  ADD CONSTRAINT "Assignment_block_covers_schedule" CHECK (
    "blockStartAt" <= "startAt" AND "blockEndAt" >= "endAt"
  );

ALTER TABLE "AvailabilityException"
  ADD CONSTRAINT "AvailabilityException_range_ordered" CHECK ("endAt" > "startAt");

ALTER TABLE "ExternalBusyBlock"
  ADD CONSTRAINT "ExternalBusyBlock_range_ordered" CHECK ("endAt" > "startAt");

-- Les disponibilités déclarées sont exprimées en minutes depuis minuit, jour
-- ISO 8601 (1 = lundi, 7 = dimanche).
ALTER TABLE "AvailabilityRule"
  ADD CONSTRAINT "AvailabilityRule_weekday_range" CHECK ("weekday" BETWEEN 1 AND 7),
  ADD CONSTRAINT "AvailabilityRule_minutes_range" CHECK (
    "startMinute" >= 0 AND "endMinute" <= 1440 AND "endMinute" > "startMinute"
  );

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_weekday_range" CHECK ("weekday" BETWEEN 1 AND 7),
  ADD CONSTRAINT "Subscription_start_minute_range" CHECK ("startMinute" BETWEEN 0 AND 1439);

-- Une note d'avis va de 1 à 5.
ALTER TABLE "Review"
  ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

-- Les montants sont des centimes entiers et ne peuvent pas être négatifs.
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_amounts_non_negative" CHECK (
    "grossAmountCents" >= 0
    AND "taxCreditAmountCents" >= 0
    AND "netAmountCents" >= 0
    AND "commissionAmountCents" >= 0
    AND "cancellationFeeCents" >= 0
  ),
  -- Le reste à charge est le montant brut diminué du crédit d'impôt. Cette
  -- égalité est affichée à chaque étape du tunnel : elle doit être vraie en
  -- base, pas seulement dans la fonction qui la calcule.
  ADD CONSTRAINT "Booking_net_equals_gross_minus_credit" CHECK (
    "netAmountCents" = "grossAmountCents" - "taxCreditAmountCents"
  );
