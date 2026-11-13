/*
  GRINDxGAMING Ledger migration
  Run once against PlayStationManager in Azure SQL / SSMS.
  Existing Billing rows are preserved and become current rows.
*/
IF COL_LENGTH('dbo.Billing', 'IsDeleted') IS NULL
BEGIN
    ALTER TABLE dbo.Billing
      ADD IsDeleted BIT NOT NULL
        CONSTRAINT DF_Billing_IsDeleted DEFAULT (0) WITH VALUES;
END;
GO

IF COL_LENGTH('dbo.Billing', 'ReplacesBillingID') IS NULL
    ALTER TABLE dbo.Billing ADD ReplacesBillingID BIGINT NULL;
GO

IF COL_LENGTH('dbo.Billing', 'EditReason') IS NULL
    ALTER TABLE dbo.Billing ADD EditReason NVARCHAR(500) NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_Billing_ReplacesBilling'
      AND parent_object_id = OBJECT_ID('dbo.Billing')
)
BEGIN
    ALTER TABLE dbo.Billing
      ADD CONSTRAINT FK_Billing_ReplacesBilling
      FOREIGN KEY (ReplacesBillingID) REFERENCES dbo.Billing(BillingID);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_Billing_OneCurrentVersionPerSession'
      AND object_id = OBJECT_ID('dbo.Billing')
)
BEGIN
    CREATE UNIQUE INDEX UX_Billing_OneCurrentVersionPerSession
      ON dbo.Billing(SessionID) WHERE IsDeleted = 0;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Billing_CurrentSession'
      AND object_id = OBJECT_ID('dbo.Billing')
)
    CREATE INDEX IX_Billing_CurrentSession
      ON dbo.Billing(SessionID, BillingID DESC) INCLUDE (IsDeleted, TotalAmount);
GO
