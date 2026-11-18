import sql from 'mssql';

export interface ConsoleRate {
  PlayersNumber: number;
  HourlyAmount: number;
  HalfHourAmount: number;
}

export interface ConsoleInput {
  PlayStationName: string;
  PlayStationType: string;
  rates: ConsoleRate[];
}

export interface Quote {
  GrossAmount: number;
  DiscountPercent: number;
  DiscountAmount: number;
  TotalAmount: number;
  PerPersonAmount: number;
  HourlyRate: number;
  HalfHourRate: number;
}

const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

export function calculateQuote(
  rate: ConsoleRate,
  durationMinutes: number,
  discountPercent: number,
): Quote {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes % 30 !== 0) {
    throw new Error('Session duration must be a positive 30-minute increment.');
  }
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    throw new Error('Discount must be between 0 and 100%.');
  }

  const fullHours = Math.floor(durationMinutes / 60);
  const remainingMinutes = durationMinutes % 60;
  const gross = (fullHours * Number(rate.HourlyAmount)) +
    (remainingMinutes === 30 ? Number(rate.HalfHourAmount) : 0);
  const grossAmount = roundMoney(gross);
  const discountAmount = roundMoney(grossAmount * (discountPercent / 100));
  const totalAmount = roundMoney(grossAmount - discountAmount);

  return {
    GrossAmount: grossAmount,
    DiscountPercent: roundMoney(discountPercent),
    DiscountAmount: discountAmount,
    TotalAmount: totalAmount,
    PerPersonAmount: roundMoney(totalAmount / rate.PlayersNumber),
    HourlyRate: roundMoney(Number(rate.HourlyAmount)),
    HalfHourRate: roundMoney(Number(rate.HalfHourAmount)),
  };
}

export class SqlServer {
  private pool?: sql.ConnectionPool;
  private connecting?: Promise<void>;

  private get isAzure(): boolean {
    const server = process.env.SQL_SERVER || 'grindxgaming-sql.database.windows.net';
    return /\.database\.windows\.net$/i.test(server);
  }

  private get config(): sql.config {
    const server = process.env.SQL_SERVER || 'grindxgaming-sql.database.windows.net';
    const isAzure = this.isAzure;
    const instanceName = process.env.SQL_INSTANCE?.trim();
    // Named instances are for on-prem SQL Server only — Azure SQL uses host + port.
    const useInstance = Boolean(instanceName) && !isAzure;
    const port = Number(process.env.SQL_PORT || 1433);

    const encrypt = process.env.SQL_ENCRYPT !== undefined
      ? String(process.env.SQL_ENCRYPT).toLowerCase() === 'true'
      : isAzure;
    const trustServerCertificate = process.env.SQL_TRUST_SERVER_CERTIFICATE !== undefined
      ? String(process.env.SQL_TRUST_SERVER_CERTIFICATE).toLowerCase() === 'true'
      : !isAzure;

    return {
      server,
      ...(useInstance ? {} : { port }),
      user: (process.env.SQL_USER || '').trim(),
      password: process.env.SQL_PASSWORD || '',
      database: process.env.SQL_DATABASE || 'PlayStationManager',
      connectionTimeout: Number(process.env.SQL_CONNECTION_TIMEOUT || (isAzure ? 30000 : 15000)),
      requestTimeout: Number(process.env.SQL_REQUEST_TIMEOUT || 30000),
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
      options: {
        encrypt,
        trustServerCertificate,
        enableArithAbort: true,
        ...(useInstance ? { instanceName } : {}),
      },
    };
  }

  private formatLoginError(error: unknown): Error {
    const code = (error as { code?: string })?.code;
    const message = error instanceof Error ? error.message : String(error);

    if (code === 'ELOGIN' || /Login failed for user/i.test(message)) {
      return new Error(
        [
          'Azure SQL login failed (ELOGIN). The server was reached, but SQL authentication was rejected.',
          'Fix in Azure Portal → SQL server "grindxgaming-sql":',
          '1) Overview → Reset password, then put the SAME password in .env as SQL_PASSWORD',
          '2) Microsoft Entra → turn OFF "Support only Microsoft Entra authentication" (SQL logins must be allowed)',
          '3) Confirm administrator login name matches SQL_USER in .env (currently expected: grindxgaming)',
        ].join(' '),
      );
    }

    if (code === 'ETIMEOUT' || /timeout/i.test(message)) {
      return new Error(
        'Azure SQL connection timed out. Allow your client IP under Azure Portal → SQL server → Networking.',
      );
    }

    return error instanceof Error ? error : new Error(message);
  }

  async connect(): Promise<void> {
    if (this.pool?.connected) return;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const config = this.config;

      const password = config.password || '';
      const placeholderPasswords = new Set([
        '',
        '<your_password>',
        'REPLACE_WITH_YOUR_AZURE_SQL_PASSWORD',
      ]);

      if (!config.user || placeholderPasswords.has(password)) {
        throw new Error(
          'Azure SQL credentials missing. Check SQL_USER and SQL_PASSWORD in .env.',
        );
      }

      const candidate = new sql.ConnectionPool(config);
      candidate.on('error', (error: Error) =>
        console.error('[Azure SQL] Pool error:', error)
      );

      try {
        await candidate.connect();
      } catch (error) {
        throw this.formatLoginError(error);
      }

      this.pool = candidate;
      console.info(
        `[Azure SQL] Connected to ${config.server}/${config.database} as ${config.user}.`,
      );
    })();

    try {
      await this.connecting;
    } catch (error) {
      this.pool = undefined;
      throw error;
    } finally {
      this.connecting = undefined;
    }
  }
  

  private async getPool(): Promise<sql.ConnectionPool> {
    await this.connect();
    if (!this.pool) throw new Error('Azure SQL connection is not available.');
    return this.pool;
  }

  async getAllPlaystations(): Promise<any[]> {
    const pool = await this.getPool();
    const [consoleResult, rateResult] = await Promise.all([
      pool.request().query(`
        SELECT
          ps.PlayStationID,
          ps.PlayStationType,
          ps.PlayStationName,
          CAST(CASE WHEN s.SessionID IS NULL THEN 1 ELSE 0 END AS bit) AS IsAvailable,
          s.SessionID AS ActiveSessionID,
          CONVERT(varchar(19), s.StartTime, 126) AS StartTime,
          s.PlayersNumber AS ActivePlayersNumber,
          s.DurationMinutes AS ActiveDurationMinutes,
          s.GrossAmount AS ActiveGrossAmount,
          s.DiscountPercent AS ActiveDiscountPercent,
          s.DiscountAmount AS ActiveDiscountAmount,
          s.TotalAmount AS ActiveTotalAmount,
          s.PerPersonAmount AS ActivePerPersonAmount
        FROM dbo.PlayStations ps
        LEFT JOIN dbo.Sessions s
          ON s.PlayStationID = ps.PlayStationID AND s.EndTime IS NULL
        WHERE ps.IsDeleted = 0
        ORDER BY ps.PlayStationID;
      `),
      pool.request().query(`
        SELECT r.PlayStationID, r.PlayersNumber, r.HourlyAmount, r.HalfHourAmount
        FROM dbo.PlayStationRates r;
      `),
    ]);

    const ratesByConsole = new Map<number, ConsoleRate[]>();
    for (const row of rateResult.recordset) {
      const id = Number(row.PlayStationID);
      const current = ratesByConsole.get(id) || [];
      current.push({
        PlayersNumber: Number(row.PlayersNumber),
        HourlyAmount: Number(row.HourlyAmount),
        HalfHourAmount: Number(row.HalfHourAmount),
      });
      ratesByConsole.set(id, current);
    }

    return consoleResult.recordset.map((row: Record<string, any>) => ({
      ...row,
      PlayStationID: Number(row.PlayStationID),
      IsAvailable: Boolean(row.IsAvailable),
      ActiveSessionID: row.ActiveSessionID == null ? null : Number(row.ActiveSessionID),
      ActivePlayersNumber: row.ActivePlayersNumber == null ? null : Number(row.ActivePlayersNumber),
      ActiveDurationMinutes: row.ActiveDurationMinutes == null ? null : Number(row.ActiveDurationMinutes),
      ActiveGrossAmount: row.ActiveGrossAmount == null ? null : Number(row.ActiveGrossAmount),
      ActiveDiscountPercent: row.ActiveDiscountPercent == null ? null : Number(row.ActiveDiscountPercent),
      ActiveDiscountAmount: row.ActiveDiscountAmount == null ? null : Number(row.ActiveDiscountAmount),
      ActiveTotalAmount: row.ActiveTotalAmount == null ? null : Number(row.ActiveTotalAmount),
      ActivePerPersonAmount: row.ActivePerPersonAmount == null ? null : Number(row.ActivePerPersonAmount),
      rates: (ratesByConsole.get(Number(row.PlayStationID)) || []).sort((a, b) => a.PlayersNumber - b.PlayersNumber),
    }));
  }

  async addPlaystation(input: ConsoleInput): Promise<number> {
    const name = input.PlayStationName.trim();
    const type = input.PlayStationType.toUpperCase();
    this.validateConsoleInput({ ...input, PlayStationName: name, PlayStationType: type });
    const pool = await this.getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const insert = await new sql.Request(transaction)
        .input('name', sql.NVarChar(100), name)
        .input('type', sql.VarChar(3), type)
        .query(`
          INSERT INTO dbo.PlayStations (PlayStationType, PlayStationName, IsAvailable, IsDeleted)
          OUTPUT INSERTED.PlayStationID
          VALUES (@type, @name, 1, 0);
        `);
      const id = Number(insert.recordset[0].PlayStationID);
      for (const rate of input.rates) {
        await new sql.Request(transaction)
          .input('id', sql.Int, id)
          .input('players', sql.TinyInt, rate.PlayersNumber)
          .input('hourly', sql.Decimal(10, 2), rate.HourlyAmount)
          .input('halfHour', sql.Decimal(10, 2), rate.HalfHourAmount)
          .query(`
            INSERT INTO dbo.PlayStationRates (PlayStationID, PlayersNumber, HourlyAmount, HalfHourAmount)
            VALUES (@id, @players, @hourly, @halfHour);
          `);
      }
      await transaction.commit();
      return id;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateConsoleRates(id: number, rates: ConsoleRate[]): Promise<void> {
    this.validateRates(rates);
    const pool = await this.getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const consoleResult = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .query(`SELECT PlayStationID FROM dbo.PlayStations WITH (UPDLOCK, ROWLOCK) WHERE PlayStationID = @id AND IsDeleted = 0 AND IsAvailable = 1;`);
      if (!consoleResult.recordset.length) throw new Error('Console not found or currently in use. End its session before changing rates.');

      await new sql.Request(transaction).input('id', sql.Int, id)
        .query('DELETE FROM dbo.PlayStationRates WHERE PlayStationID = @id;');
      for (const rate of rates) {
        await new sql.Request(transaction)
          .input('id', sql.Int, id)
          .input('players', sql.TinyInt, rate.PlayersNumber)
          .input('hourly', sql.Decimal(10, 2), rate.HourlyAmount)
          .input('halfHour', sql.Decimal(10, 2), rate.HalfHourAmount)
          .query(`
            INSERT INTO dbo.PlayStationRates (PlayStationID, PlayersNumber, HourlyAmount, HalfHourAmount)
            VALUES (@id, @players, @hourly, @halfHour);
          `);
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getSession(playStationId: number): Promise<any | null> {
    const pool = await this.getPool();
    const result = await pool.request().input('id', sql.Int, playStationId).query(`
      SELECT TOP (1)
        SessionID, PlayStationID, PlayersNumber, DurationMinutes,
        CONVERT(varchar(19), StartTime, 126) AS StartTime,
        GrossAmount, DiscountPercent, DiscountAmount, TotalAmount, PerPersonAmount,
        HourlyRate, HalfHourRate
      FROM dbo.Sessions
      WHERE PlayStationID = @id AND EndTime IS NULL
      ORDER BY SessionID DESC;
    `);
    return result.recordset[0] || null;
  }

  async reserve(playStationId: number, playersNumber: number, durationMinutes: number, discountPercent: number): Promise<any> {
    this.validatePlayers(playersNumber);
    const pool = await this.getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const consoleResult = await new sql.Request(transaction)
        .input('id', sql.Int, playStationId)
        .query(`SELECT PlayStationID FROM dbo.PlayStations WITH (UPDLOCK, ROWLOCK) WHERE PlayStationID = @id AND IsDeleted = 0 AND IsAvailable = 1;`);
      if (!consoleResult.recordset.length) throw new Error('This console is already reserved or does not exist.');

      const rate = await this.getRate(transaction, playStationId, playersNumber);
      const quote = calculateQuote(rate, durationMinutes, discountPercent);
      const insertResult = await new sql.Request(transaction)
        .input('id', sql.Int, playStationId)
        .input('players', sql.TinyInt, playersNumber)
        .input('duration', sql.Int, durationMinutes)
        .input('hourlyRate', sql.Decimal(10, 2), quote.HourlyRate)
        .input('halfHourRate', sql.Decimal(10, 2), quote.HalfHourRate)
        .input('gross', sql.Decimal(10, 2), quote.GrossAmount)
        .input('discountPercent', sql.Decimal(5, 2), quote.DiscountPercent)
        .input('discountAmount', sql.Decimal(10, 2), quote.DiscountAmount)
        .input('total', sql.Decimal(10, 2), quote.TotalAmount)
        .input('perPerson', sql.Decimal(10, 2), quote.PerPersonAmount)
        .query(`
          INSERT INTO dbo.Sessions
            (PlayStationID, PlayersNumber, DurationMinutes, StartTime, HourlyRate, HalfHourRate,
             GrossAmount, DiscountPercent, DiscountAmount, TotalAmount, PerPersonAmount)
          OUTPUT INSERTED.SessionID, CONVERT(varchar(19), INSERTED.StartTime, 126) AS StartTime
          VALUES
            (@id, @players, @duration, SYSDATETIME(), @hourlyRate, @halfHourRate,
             @gross, @discountPercent, @discountAmount, @total, @perPerson);
        `);
      await new sql.Request(transaction).input('id', sql.Int, playStationId)
        .query('UPDATE dbo.PlayStations SET IsAvailable = 0 WHERE PlayStationID = @id;');
      await transaction.commit();
      return { SessionID: Number(insertResult.recordset[0].SessionID), ...quote, PlayersNumber: playersNumber, DurationMinutes: durationMinutes, StartTime: String(insertResult.recordset[0].StartTime).replace(' ', 'T') };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async addPlayers(playStationId: number, additionalPlayers: number): Promise<void> {
    if (!Number.isInteger(additionalPlayers) || additionalPlayers < 1) throw new Error('Choose at least one additional player.');
    const pool = await this.getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const session = await this.getActiveSessionForUpdate(transaction, playStationId);
      const newPlayers = Number(session.PlayersNumber) + additionalPlayers;
      this.validatePlayers(newPlayers);
      const rate = await this.getRate(transaction, playStationId, newPlayers);
      const quote = calculateQuote({ ...rate, PlayersNumber: newPlayers }, Number(session.DurationMinutes), Number(session.DiscountPercent));
      await this.updateSessionQuote(transaction, Number(session.SessionID), newPlayers, Number(session.DurationMinutes), quote);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async extendTime(playStationId: number, additionalMinutes: number): Promise<void> {
    if (!Number.isInteger(additionalMinutes) || additionalMinutes < 30 || additionalMinutes % 30 !== 0) throw new Error('Extension must be in 30-minute increments.');
    const pool = await this.getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const session = await this.getActiveSessionForUpdate(transaction, playStationId);
      const newDuration = Number(session.DurationMinutes) + additionalMinutes;
      const players = Number(session.PlayersNumber);
      const rate = await this.getRate(transaction, playStationId, players);
      const quote = calculateQuote({ ...rate, PlayersNumber: players }, newDuration, Number(session.DiscountPercent));
      await this.updateSessionQuote(transaction, Number(session.SessionID), players, newDuration, quote);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async endSession(playStationId: number): Promise<any> {
    const pool = await this.getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const session = await this.getActiveSessionForUpdate(transaction, playStationId);
      const endResult = await new sql.Request(transaction)
        .input('sessionId', sql.BigInt, Number(session.SessionID))
        .query('UPDATE dbo.Sessions SET EndTime = SYSDATETIME() OUTPUT CONVERT(varchar(19), INSERTED.EndTime, 126) AS EndTime WHERE SessionID = @sessionId;');
      await new sql.Request(transaction).input('id', sql.Int, playStationId)
        .query('UPDATE dbo.PlayStations SET IsAvailable = 1 WHERE PlayStationID = @id;');
      const billing = await new sql.Request(transaction)
        .input('sessionId', sql.BigInt, Number(session.SessionID))
        .input('id', sql.Int, playStationId)
        .input('players', sql.TinyInt, Number(session.PlayersNumber))
        .input('duration', sql.Int, Number(session.DurationMinutes))
        .input('gross', sql.Decimal(10, 2), Number(session.GrossAmount))
        .input('discountPercent', sql.Decimal(5, 2), Number(session.DiscountPercent))
        .input('discountAmount', sql.Decimal(10, 2), Number(session.DiscountAmount))
        .input('total', sql.Decimal(10, 2), Number(session.TotalAmount))
        .input('perPerson', sql.Decimal(10, 2), Number(session.PerPersonAmount))
        .query(`
          INSERT INTO dbo.Billing
            (SessionID, PlayStationID, PlayersNumber, DurationMinutes, GrossAmount, DiscountPercent,
             DiscountAmount, TotalAmount, PerPersonAmount)
          OUTPUT INSERTED.BillingID
          VALUES
            (@sessionId, @id, @players, @duration, @gross, @discountPercent,
             @discountAmount, @total, @perPerson);
        `);
      await transaction.commit();
      return { ...session, EndTime: endResult.recordset[0]?.EndTime, BillingID: Number(billing.recordset[0].BillingID) };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }


  async getLedger(fromDate: string, toDate: string): Promise<any[]> {
    const pool = await this.getPool();
    const result = await pool.request()
      .input('fromDate', sql.Date, fromDate)
      .input('toDate', sql.Date, toDate)
      .query(`
        SELECT b.BillingID, b.SessionID, b.PlayStationID, p.PlayStationName,
          s.StartTime, s.EndTime, b.PlayersNumber, b.DurationMinutes,
          b.GrossAmount, b.DiscountPercent, b.DiscountAmount, b.TotalAmount,
          b.PerPersonAmount, b.CreatedAt
        FROM dbo.Billing b
        INNER JOIN dbo.Sessions s ON s.SessionID = b.SessionID
        INNER JOIN dbo.PlayStations p ON p.PlayStationID = s.PlayStationID
        WHERE b.IsDeleted = 0
          AND s.EndTime >= @fromDate
          AND s.EndTime < DATEADD(day, 1, @toDate)
        ORDER BY s.EndTime DESC, b.BillingID DESC;
      `);
    return result.recordset;
  }

  async getBillingHistory(sessionId: number): Promise<any[]> {
    const pool = await this.getPool();
    const result = await pool.request()
      .input('sessionId', sql.BigInt, sessionId)
      .query(`
        SELECT b.BillingID, b.SessionID, b.PlayersNumber, b.DurationMinutes,
          b.GrossAmount, b.DiscountPercent, b.DiscountAmount, b.TotalAmount,
          b.PerPersonAmount, b.CreatedAt, b.IsDeleted, b.ReplacesBillingID, b.EditReason
        FROM dbo.Billing b
        WHERE b.SessionID = @sessionId
        ORDER BY b.BillingID DESC;
      `);
    return result.recordset;
  }

  async editBilling(billingId: number, input: any): Promise<{ BillingID: number }> {
    const players = Number(input.PlayersNumber);
    const duration = Number(input.DurationMinutes);
    const gross = Number(input.GrossAmount);
    const discountPercent = Number(input.DiscountPercent);
    const discountAmount = Number(input.DiscountAmount);
    const total = Number(input.TotalAmount);
    const perPerson = Number(input.PerPersonAmount);
    if (!Number.isInteger(players) || players < 1 || players > 4) throw new Error('Players must be between 1 and 4.');
    if (!Number.isInteger(duration) || duration < 1) throw new Error('Duration must be a positive number of minutes.');
    if ([gross, discountPercent, discountAmount, total, perPerson].some(v => !Number.isFinite(v) || v < 0)) throw new Error('Billing amounts must be valid non-negative numbers.');
    if (discountPercent > 100) throw new Error('Discount cannot exceed 100%.');
    const pool = await this.getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const current = await new sql.Request(transaction)
        .input('id', sql.BigInt, billingId)
        .query('SELECT TOP (1) * FROM dbo.Billing WITH (UPDLOCK, ROWLOCK) WHERE BillingID = @id AND IsDeleted = 0;');
      if (!current.recordset.length) throw new Error('This billing entry is no longer current. Refresh the ledger.');
      const old = current.recordset[0];
      const inserted = await new sql.Request(transaction)
        .input('sessionId', sql.BigInt, Number(old.SessionID))
        .input('consoleId', sql.Int, Number(old.PlayStationID))
        .input('players', sql.TinyInt, players)
        .input('duration', sql.Int, duration)
        .input('gross', sql.Decimal(10, 2), gross)
        .input('discountPercent', sql.Decimal(5, 2), discountPercent)
        .input('discountAmount', sql.Decimal(10, 2), discountAmount)
        .input('total', sql.Decimal(10, 2), total)
        .input('perPerson', sql.Decimal(10, 2), perPerson)
        .input('oldId', sql.BigInt, billingId)
        .input('reason', sql.NVarChar(500), String(input.EditReason || '').slice(0, 500))
        .query(`
          UPDATE dbo.Billing SET IsDeleted = 1 WHERE BillingID = @oldId AND IsDeleted = 0;
          INSERT INTO dbo.Billing
            (SessionID, PlayStationID, PlayersNumber, DurationMinutes, GrossAmount,
             DiscountPercent, DiscountAmount, TotalAmount, PerPersonAmount,
             ReplacesBillingID, EditReason)
          OUTPUT INSERTED.BillingID
          VALUES
            (@sessionId, @consoleId, @players, @duration, @gross,
             @discountPercent, @discountAmount, @total, @perPerson,
             @oldId, @reason);
        `);
      await transaction.commit();
      return { BillingID: Number(inserted.recordset[0].BillingID) };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteBilling(billingId: number, reason = ''): Promise<void> {
    const pool = await this.getPool();
    const result = await pool.request()
      .input('id', sql.BigInt, billingId)
      .input('reason', sql.NVarChar(500), reason.slice(0, 500))
      .query(`
        UPDATE dbo.Billing
        SET IsDeleted = 1, EditReason = CASE WHEN @reason = '' THEN EditReason ELSE @reason END
        WHERE BillingID = @id AND IsDeleted = 0;
      `);
    if (!result.rowsAffected[0]) throw new Error('Billing entry not found or already deleted.');
  }

  async deletePlaystation(playStationId: number): Promise<void> {
    const pool = await this.getPool();
    const result = await pool.request().input('id', sql.Int, playStationId).query(`
      UPDATE dbo.PlayStations
      SET IsDeleted = 1
      WHERE PlayStationID = @id AND IsAvailable = 1 AND IsDeleted = 0;
    `);
    if (!result.rowsAffected[0]) throw new Error('Console could not be deleted. It may be in an active session.');
  }

  async resetAll(): Promise<void> {
    const pool = await this.getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction).query('DELETE FROM dbo.Billing; DELETE FROM dbo.Sessions; DELETE FROM dbo.PlayStationRates; DELETE FROM dbo.PlayStations;');
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private validateConsoleInput(input: ConsoleInput): void {
    if (!input.PlayStationName || input.PlayStationName.length > 100) throw new Error('Enter a console name (maximum 100 characters).');
    if (!['PS3', 'PS4', 'PS5'].includes(input.PlayStationType)) throw new Error('Choose PS3, PS4 or PS5.');
    this.validateRates(input.rates);
  }

  private validateRates(rates: ConsoleRate[]): void {
    if (!Array.isArray(rates) || rates.length !== 4) throw new Error('Add rates for 1, 2, 3 and 4 players.');
    const playerCounts = new Set(rates.map((rate) => Number(rate.PlayersNumber)));
    if ([1, 2, 3, 4].some((count) => !playerCounts.has(count))) throw new Error('Rates must include all player counts from 1 to 4.');
    for (const rate of rates) {
      if (![rate.HourlyAmount, rate.HalfHourAmount].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0)) {
        throw new Error('Rates must be valid non-negative amounts.');
      }
    }
  }

  private validatePlayers(playersNumber: number): void {
    if (!Number.isInteger(playersNumber) || playersNumber < 1 || playersNumber > 4) throw new Error('Player count must be between 1 and 4.');
  }

  private async getRate(
    source: sql.ConnectionPool | sql.Transaction,
    playStationId: number,
    playersNumber: number
  ): Promise<ConsoleRate> {
    const request = source instanceof sql.Transaction
      ? new sql.Request(source)
      : new sql.Request(source);
  
    const result = await request
      .input('id', sql.Int, playStationId)
      .input('players', sql.TinyInt, playersNumber)
      .query(`
        SELECT PlayersNumber, HourlyAmount, HalfHourAmount
        FROM dbo.PlayStationRates
        WHERE PlayStationID = @id AND PlayersNumber = @players;
      `);
  
    if (!result.recordset.length) {
      throw new Error(
        `No saved rate exists for ${playersNumber} player(s). Edit this console's rates in setup.`
      );
    }
  
    const row = result.recordset[0];
  
    return {
      PlayersNumber: Number(row.PlayersNumber),
      HourlyAmount: Number(row.HourlyAmount),
      HalfHourAmount: Number(row.HalfHourAmount)
    };
  }

  private async getActiveSessionForUpdate(transaction: sql.Transaction, playStationId: number): Promise<any> {
    const result = await new sql.Request(transaction)
      .input('id', sql.Int, playStationId)
      .query(`
        SELECT TOP (1) * FROM dbo.Sessions WITH (UPDLOCK, ROWLOCK)
        WHERE PlayStationID = @id AND EndTime IS NULL ORDER BY SessionID DESC;
      `);
    if (!result.recordset.length) throw new Error('No active session was found for this console.');
    return result.recordset[0];
  }

  private async updateSessionQuote(
    transaction: sql.Transaction,
    sessionId: number,
    players: number,
    duration: number,
    quote: Quote,
  ): Promise<void> {
    await new sql.Request(transaction)
      .input('sessionId', sql.BigInt, sessionId)
      .input('players', sql.TinyInt, players)
      .input('duration', sql.Int, duration)
      .input('hourlyRate', sql.Decimal(10, 2), quote.HourlyRate)
      .input('halfHourRate', sql.Decimal(10, 2), quote.HalfHourRate)
      .input('gross', sql.Decimal(10, 2), quote.GrossAmount)
      .input('discountPercent', sql.Decimal(5, 2), quote.DiscountPercent)
      .input('discountAmount', sql.Decimal(10, 2), quote.DiscountAmount)
      .input('total', sql.Decimal(10, 2), quote.TotalAmount)
      .input('perPerson', sql.Decimal(10, 2), quote.PerPersonAmount)
      .query(`
        UPDATE dbo.Sessions
        SET PlayersNumber = @players, DurationMinutes = @duration, HourlyRate = @hourlyRate,
            HalfHourRate = @halfHourRate, GrossAmount = @gross, DiscountPercent = @discountPercent,
            DiscountAmount = @discountAmount, TotalAmount = @total, PerPersonAmount = @perPerson
        WHERE SessionID = @sessionId;
      `);
  }

  async close(): Promise<void> {
    if (this.pool) {
      const pool = this.pool;
      this.pool = undefined;
      await pool.close();
    }
  }
}
