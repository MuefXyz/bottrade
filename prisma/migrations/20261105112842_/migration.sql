-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "language" TEXT NOT NULL DEFAULT 'id',
    "walletAddress" TEXT,
    "encryptedPrivateKey" TEXT,
    "welcomeMessageId" INTEGER,
    "copyTakeProfitPct" REAL,
    "copyStopLossPct" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WatchedWallet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telegramId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CopyPosition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telegramId" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "symbol" TEXT,
    "sourceWallet" TEXT NOT NULL,
    "amountSol" REAL NOT NULL,
    "tokenAmount" REAL,
    "entryPriceUsd" REAL,
    "takeProfitPct" REAL,
    "stopLossPct" REAL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "txSignature" TEXT,
    "closeSignature" TEXT,
    "closeReason" TEXT,
    "closePriceUsd" REAL,
    "pnlPct" REAL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "WatchedWallet_address_idx" ON "WatchedWallet"("address");

-- CreateIndex
CREATE UNIQUE INDEX "WatchedWallet_telegramId_address_key" ON "WatchedWallet"("telegramId", "address");

-- CreateIndex
CREATE INDEX "CopyPosition_telegramId_status_idx" ON "CopyPosition"("telegramId", "status");

-- CreateIndex
CREATE INDEX "CopyPosition_mint_idx" ON "CopyPosition"("mint");

-- CreateIndex
CREATE INDEX "CopyPosition_status_idx" ON "CopyPosition"("status");
