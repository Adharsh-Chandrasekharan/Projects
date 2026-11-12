/*
  PlayStation Manager - local SQL Server schema
  Run this script in SQL Server Management Studio (SSMS) for on-prem / local SQL.

  For Azure SQL Database, use schema-azure.sql instead (database is created in the Azure Portal).
*/
IF DB_ID(N'PlayStationManager') IS NULL
BEGIN
    CREATE DATABASE PlayStationManager;
END;
GO

USE PlayStationManager;
GO

IF OBJECT_ID(N'dbo.PlayStations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PlayStations (
        PlayStationID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PlayStations PRIMARY KEY,
        PlayStationType VARCHAR(3) NOT NULL,
        PlayStationName NVARCHAR(100) NOT NULL,
        IsAvailable BIT NOT NULL CONSTRAINT DF_PlayStations_IsAvailable DEFAULT (1),
        IsDeleted BIT NOT NULL CONSTRAINT DF_PlayStations_IsDeleted DEFAULT (0),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PlayStations_CreatedAt DEFAULT (SYSDATETIME()),
        CONSTRAINT CK_PlayStations_Type CHECK (PlayStationType IN ('PS3', 'PS4', 'PS5'))
    );
    CREATE UNIQUE INDEX UX_PlayStations_ActiveName
        ON dbo.PlayStations(PlayStationName) WHERE IsDeleted = 0;
END;
GO

IF OBJECT_ID(N'dbo.PlayStationRates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PlayStationRates (
        RateID INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PlayStationRates PRIMARY KEY,
        PlayStationID INT NOT NULL,
        PlayersNumber TINYINT NOT NULL,
        HourlyAmount DECIMAL(10,2) NOT NULL,
        HalfHourAmount DECIMAL(10,2) NOT NULL,
        CONSTRAINT FK_PlayStationRates_PlayStations FOREIGN KEY (PlayStationID)
            REFERENCES dbo.PlayStations(PlayStationID),
        CONSTRAINT UQ_PlayStationRates_ConsolePlayers UNIQUE (PlayStationID, PlayersNumber),
        CONSTRAINT CK_PlayStationRates_Players CHECK (PlayersNumber BETWEEN 1 AND 4),
        CONSTRAINT CK_PlayStationRates_Amounts CHECK (HourlyAmount >= 0 AND HalfHourAmount >= 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.Sessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Sessions (
        SessionID BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Sessions PRIMARY KEY,
        PlayStationID INT NOT NULL,
        PlayersNumber TINYINT NOT NULL,
        DurationMinutes INT NOT NULL,
        StartTime DATETIME2(0) NOT NULL,
        EndTime DATETIME2(0) NULL,
        HourlyRate DECIMAL(10,2) NOT NULL,
        HalfHourRate DECIMAL(10,2) NOT NULL,
        GrossAmount DECIMAL(10,2) NOT NULL,
        DiscountPercent DECIMAL(5,2) NOT NULL CONSTRAINT DF_Sessions_DiscountPercent DEFAULT (0),
        DiscountAmount DECIMAL(10,2) NOT NULL CONSTRAINT DF_Sessions_DiscountAmount DEFAULT (0),
        TotalAmount DECIMAL(10,2) NOT NULL,
        PerPersonAmount DECIMAL(10,2) NOT NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Sessions_CreatedAt DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_Sessions_PlayStations FOREIGN KEY (PlayStationID)
            REFERENCES dbo.PlayStations(PlayStationID),
        CONSTRAINT CK_Sessions_Players CHECK (PlayersNumber BETWEEN 1 AND 4),
        CONSTRAINT CK_Sessions_Duration CHECK (DurationMinutes >= 30 AND DurationMinutes % 30 = 0),
        CONSTRAINT CK_Sessions_Discount CHECK (DiscountPercent BETWEEN 0 AND 100)
    );
    CREATE UNIQUE INDEX UX_Sessions_OneActiveSessionPerConsole
        ON dbo.Sessions(PlayStationID) WHERE EndTime IS NULL;
    CREATE INDEX IX_Sessions_StartTime ON dbo.Sessions(StartTime DESC);
END;
GO

IF OBJECT_ID(N'dbo.Billing', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Billing (
        BillingID BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Billing PRIMARY KEY,
        SessionID BIGINT NOT NULL,
        PlayStationID INT NOT NULL,
        PlayersNumber TINYINT NOT NULL,
        DurationMinutes INT NOT NULL,
        GrossAmount DECIMAL(10,2) NOT NULL,
        DiscountPercent DECIMAL(5,2) NOT NULL,
        DiscountAmount DECIMAL(10,2) NOT NULL,
        TotalAmount DECIMAL(10,2) NOT NULL,
        PerPersonAmount DECIMAL(10,2) NOT NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Billing_CreatedAt DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_Billing_Sessions FOREIGN KEY (SessionID) REFERENCES dbo.Sessions(SessionID),
        CONSTRAINT FK_Billing_PlayStations FOREIGN KEY (PlayStationID) REFERENCES dbo.PlayStations(PlayStationID)
    );
    CREATE INDEX IX_Billing_CreatedAt ON dbo.Billing(CreatedAt DESC);
END;
GO

/* Optional view for daily billing summaries. */
CREATE OR ALTER VIEW dbo.vw_DailyBilling
AS
SELECT
    CAST(CreatedAt AS date) AS BillingDate,
    COUNT_BIG(*) AS SessionsClosed,
    SUM(GrossAmount) AS GrossRevenue,
    SUM(DiscountAmount) AS DiscountsGiven,
    SUM(TotalAmount) AS NetRevenue
FROM dbo.Billing
GROUP BY CAST(CreatedAt AS date);
GO
