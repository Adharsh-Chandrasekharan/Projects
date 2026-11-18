"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlServer = exports.calculateQuote = void 0;
const mssql_1 = __importDefault(require("mssql"));
const roundMoney = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;
function calculateQuote(rate, durationMinutes, discountPercent) {
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
exports.calculateQuote = calculateQuote;
class SqlServer {
    get isAzure() {
        const server = process.env.SQL_SERVER || 'grindxgaming-sql.database.windows.net';
        return /\.database\.windows\.net$/i.test(server);
    }
    get config() {
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
    formatLoginError(error) {
        const code = error?.code;
        const message = error instanceof Error ? error.message : String(error);
        if (code === 'ELOGIN' || /Login failed for user/i.test(message)) {
            return new Error([
                'Azure SQL login failed (ELOGIN). The server was reached, but SQL authentication was rejected.',
                'Fix in Azure Portal → SQL server "grindxgaming-sql":',
                '1) Overview → Reset password, then put the SAME password in .env as SQL_PASSWORD',
                '2) Microsoft Entra → turn OFF "Support only Microsoft Entra authentication" (SQL logins must be allowed)',
                '3) Confirm administrator login name matches SQL_USER in .env (currently expected: grindxgaming)',
            ].join(' '));
        }
        if (code === 'ETIMEOUT' || /timeout/i.test(message)) {
            return new Error('Azure SQL connection timed out. Allow your client IP under Azure Portal → SQL server → Networking.');
        }
        return error instanceof Error ? error : new Error(message);
    }
    async connect() {
        if (this.pool?.connected)
            return;
        if (this.connecting)
            return this.connecting;
        this.connecting = (async () => {
            const config = this.config;
            const password = config.password || '';
            const placeholderPasswords = new Set([
                '',
                '<your_password>',
                'REPLACE_WITH_YOUR_AZURE_SQL_PASSWORD',
            ]);
            if (!config.user || placeholderPasswords.has(password)) {
                throw new Error('Azure SQL credentials missing. Check SQL_USER and SQL_PASSWORD in .env.');
            }
            const candidate = new mssql_1.default.ConnectionPool(config);
            candidate.on('error', (error) => console.error('[Azure SQL] Pool error:', error));
            try {
                await candidate.connect();
            }
            catch (error) {
                throw this.formatLoginError(error);
            }
            this.pool = candidate;
            console.info(`[Azure SQL] Connected to ${config.server}/${config.database} as ${config.user}.`);
        })();
        try {
            await this.connecting;
        }
        catch (error) {
            this.pool = undefined;
            throw error;
        }
        finally {
            this.connecting = undefined;
        }
    }
    async getPool() {
        await this.connect();
        if (!this.pool)
            throw new Error('Azure SQL connection is not available.');
        return this.pool;
    }
    async getAllPlaystations() {
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
        const ratesByConsole = new Map();
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
        return consoleResult.recordset.map((row) => ({
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
    async addPlaystation(input) {
        const name = input.PlayStationName.trim();
        const type = input.PlayStationType.toUpperCase();
        this.validateConsoleInput({ ...input, PlayStationName: name, PlayStationType: type });
        const pool = await this.getPool();
        const transaction = new mssql_1.default.Transaction(pool);
        await transaction.begin();
        try {
            const insert = await new mssql_1.default.Request(transaction)
                .input('name', mssql_1.default.NVarChar(100), name)
                .input('type', mssql_1.default.VarChar(3), type)
                .query(`
          INSERT INTO dbo.PlayStations (PlayStationType, PlayStationName, IsAvailable, IsDeleted)
          OUTPUT INSERTED.PlayStationID
          VALUES (@type, @name, 1, 0);
        `);
            const id = Number(insert.recordset[0].PlayStationID);
            for (const rate of input.rates) {
                await new mssql_1.default.Request(transaction)
                    .input('id', mssql_1.default.Int, id)
                    .input('players', mssql_1.default.TinyInt, rate.PlayersNumber)
                    .input('hourly', mssql_1.default.Decimal(10, 2), rate.HourlyAmount)
                    .input('halfHour', mssql_1.default.Decimal(10, 2), rate.HalfHourAmount)
                    .query(`
            INSERT INTO dbo.PlayStationRates (PlayStationID, PlayersNumber, HourlyAmount, HalfHourAmount)
            VALUES (@id, @players, @hourly, @halfHour);
          `);
            }
            await transaction.commit();
            return id;
        }
        catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    async updateConsoleRates(id, rates) {
        this.validateRates(rates);
        const pool = await this.getPool();
        const transaction = new mssql_1.default.Transaction(pool);
        await transaction.begin();
        try {
            const consoleResult = await new mssql_1.default.Request(transaction)
                .input('id', mssql_1.default.Int, id)
                .query(`SELECT PlayStationID FROM dbo.PlayStations WITH (UPDLOCK, ROWLOCK) WHERE PlayStationID = @id AND IsDeleted = 0 AND IsAvailable = 1;`);
            if (!consoleResult.recordset.length)
                throw new Error('Console not found or currently in use. End its session before changing rates.');
            await new mssql_1.default.Request(transaction).input('id', mssql_1.default.Int, id)
                .query('DELETE FROM dbo.PlayStationRates WHERE PlayStationID = @id;');
            for (const rate of rates) {
                await new mssql_1.default.Request(transaction)
                    .input('id', mssql_1.default.Int, id)
                    .input('players', mssql_1.default.TinyInt, rate.PlayersNumber)
                    .input('hourly', mssql_1.default.Decimal(10, 2), rate.HourlyAmount)
                    .input('halfHour', mssql_1.default.Decimal(10, 2), rate.HalfHourAmount)
                    .query(`
            INSERT INTO dbo.PlayStationRates (PlayStationID, PlayersNumber, HourlyAmount, HalfHourAmount)
            VALUES (@id, @players, @hourly, @halfHour);
          `);
            }
            await transaction.commit();
        }
        catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    async getSession(playStationId) {
        const pool = await this.getPool();
        const result = await pool.request().input('id', mssql_1.default.Int, playStationId).query(`
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
    async reserve(playStationId, playersNumber, durationMinutes, discountPercent) {
        this.validatePlayers(playersNumber);
        const pool = await this.getPool();
        const transaction = new mssql_1.default.Transaction(pool);
        await transaction.begin();
        try {
            const consoleResult = await new mssql_1.default.Request(transaction)
                .input('id', mssql_1.default.Int, playStationId)
                .query(`SELECT PlayStationID FROM dbo.PlayStations WITH (UPDLOCK, ROWLOCK) WHERE PlayStationID = @id AND IsDeleted = 0 AND IsAvailable = 1;`);
            if (!consoleResult.recordset.length)
                throw new Error('This console is already reserved or does not exist.');
            const rate = await this.getRate(transaction, playStationId, playersNumber);
            const quote = calculateQuote(rate, durationMinutes, discountPercent);
            const insertResult = await new mssql_1.default.Request(transaction)
                .input('id', mssql_1.default.Int, playStationId)
                .input('players', mssql_1.default.TinyInt, playersNumber)
                .input('duration', mssql_1.default.Int, durationMinutes)
                .input('hourlyRate', mssql_1.default.Decimal(10, 2), quote.HourlyRate)
                .input('halfHourRate', mssql_1.default.Decimal(10, 2), quote.HalfHourRate)
                .input('gross', mssql_1.default.Decimal(10, 2), quote.GrossAmount)
                .input('discountPercent', mssql_1.default.Decimal(5, 2), quote.DiscountPercent)
                .input('discountAmount', mssql_1.default.Decimal(10, 2), quote.DiscountAmount)
                .input('total', mssql_1.default.Decimal(10, 2), quote.TotalAmount)
                .input('perPerson', mssql_1.default.Decimal(10, 2), quote.PerPersonAmount)
                .query(`
          INSERT INTO dbo.Sessions
            (PlayStationID, PlayersNumber, DurationMinutes, StartTime, HourlyRate, HalfHourRate,
             GrossAmount, DiscountPercent, DiscountAmount, TotalAmount, PerPersonAmount)
          OUTPUT INSERTED.SessionID, CONVERT(varchar(19), INSERTED.StartTime, 126) AS StartTime
          VALUES
            (@id, @players, @duration, SYSDATETIME(), @hourlyRate, @halfHourRate,
             @gross, @discountPercent, @discountAmount, @total, @perPerson);
        `);
            await new mssql_1.default.Request(transaction).input('id', mssql_1.default.Int, playStationId)
                .query('UPDATE dbo.PlayStations SET IsAvailable = 0 WHERE PlayStationID = @id;');
            await transaction.commit();
            return { SessionID: Number(insertResult.recordset[0].SessionID), ...quote, PlayersNumber: playersNumber, DurationMinutes: durationMinutes, StartTime: String(insertResult.recordset[0].StartTime).replace(' ', 'T') };
        }
        catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    async addPlayers(playStationId, additionalPlayers) {
        if (!Number.isInteger(additionalPlayers) || additionalPlayers < 1)
            throw new Error('Choose at least one additional player.');
        const pool = await this.getPool();
        const transaction = new mssql_1.default.Transaction(pool);
        await transaction.begin();
        try {
            const session = await this.getActiveSessionForUpdate(transaction, playStationId);
            const newPlayers = Number(session.PlayersNumber) + additionalPlayers;
            this.validatePlayers(newPlayers);
            const rate = await this.getRate(transaction, playStationId, newPlayers);
            const quote = calculateQuote({ ...rate, PlayersNumber: newPlayers }, Number(session.DurationMinutes), Number(session.DiscountPercent));
            await this.updateSessionQuote(transaction, Number(session.SessionID), newPlayers, Number(session.DurationMinutes), quote);
            await transaction.commit();
        }
        catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    async extendTime(playStationId, additionalMinutes) {
        if (!Number.isInteger(additionalMinutes) || additionalMinutes < 30 || additionalMinutes % 30 !== 0)
            throw new Error('Extension must be in 30-minute increments.');
        const pool = await this.getPool();
        const transaction = new mssql_1.default.Transaction(pool);
        await transaction.begin();
        try {
            const session = await this.getActiveSessionForUpdate(transaction, playStationId);
            const newDuration = Number(session.DurationMinutes) + additionalMinutes;
            const players = Number(session.PlayersNumber);
            const rate = await this.getRate(transaction, playStationId, players);
            const quote = calculateQuote({ ...rate, PlayersNumber: players }, newDuration, Number(session.DiscountPercent));
            await this.updateSessionQuote(transaction, Number(session.SessionID), players, newDuration, quote);
            await transaction.commit();
        }
        catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    async endSession(playStationId) {
        const pool = await this.getPool();
        const transaction = new mssql_1.default.Transaction(pool);
        await transaction.begin();
        try {
            const session = await this.getActiveSessionForUpdate(transaction, playStationId);
            const endResult = await new mssql_1.default.Request(transaction)
                .input('sessionId', mssql_1.default.BigInt, Number(session.SessionID))
                .query('UPDATE dbo.Sessions SET EndTime = SYSDATETIME() OUTPUT CONVERT(varchar(19), INSERTED.EndTime, 126) AS EndTime WHERE SessionID = @sessionId;');
            await new mssql_1.default.Request(transaction).input('id', mssql_1.default.Int, playStationId)
                .query('UPDATE dbo.PlayStations SET IsAvailable = 1 WHERE PlayStationID = @id;');
            const billing = await new mssql_1.default.Request(transaction)
                .input('sessionId', mssql_1.default.BigInt, Number(session.SessionID))
                .input('id', mssql_1.default.Int, playStationId)
                .input('players', mssql_1.default.TinyInt, Number(session.PlayersNumber))
                .input('duration', mssql_1.default.Int, Number(session.DurationMinutes))
                .input('gross', mssql_1.default.Decimal(10, 2), Number(session.GrossAmount))
                .input('discountPercent', mssql_1.default.Decimal(5, 2), Number(session.DiscountPercent))
                .input('discountAmount', mssql_1.default.Decimal(10, 2), Number(session.DiscountAmount))
                .input('total', mssql_1.default.Decimal(10, 2), Number(session.TotalAmount))
                .input('perPerson', mssql_1.default.Decimal(10, 2), Number(session.PerPersonAmount))
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
        }
        catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    async deletePlaystation(playStationId) {
        const pool = await this.getPool();
        const result = await pool.request().input('id', mssql_1.default.Int, playStationId).query(`
      UPDATE dbo.PlayStations
      SET IsDeleted = 1
      WHERE PlayStationID = @id AND IsAvailable = 1 AND IsDeleted = 0;
    `);
        if (!result.rowsAffected[0])
            throw new Error('Console could not be deleted. It may be in an active session.');
    }
    async resetAll() {
        const pool = await this.getPool();
        const transaction = new mssql_1.default.Transaction(pool);
        await transaction.begin();
        try {
            await new mssql_1.default.Request(transaction).query('DELETE FROM dbo.Billing; DELETE FROM dbo.Sessions; DELETE FROM dbo.PlayStationRates; DELETE FROM dbo.PlayStations;');
            await transaction.commit();
        }
        catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    validateConsoleInput(input) {
        if (!input.PlayStationName || input.PlayStationName.length > 100)
            throw new Error('Enter a console name (maximum 100 characters).');
        if (!['PS3', 'PS4', 'PS5'].includes(input.PlayStationType))
            throw new Error('Choose PS3, PS4 or PS5.');
        this.validateRates(input.rates);
    }
    validateRates(rates) {
        if (!Array.isArray(rates) || rates.length !== 4)
            throw new Error('Add rates for 1, 2, 3 and 4 players.');
        const playerCounts = new Set(rates.map((rate) => Number(rate.PlayersNumber)));
        if ([1, 2, 3, 4].some((count) => !playerCounts.has(count)))
            throw new Error('Rates must include all player counts from 1 to 4.');
        for (const rate of rates) {
            if (![rate.HourlyAmount, rate.HalfHourAmount].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0)) {
                throw new Error('Rates must be valid non-negative amounts.');
            }
        }
    }
    validatePlayers(playersNumber) {
        if (!Number.isInteger(playersNumber) || playersNumber < 1 || playersNumber > 4)
            throw new Error('Player count must be between 1 and 4.');
    }
    async getRate(source, playStationId, playersNumber) {
        const request = source instanceof mssql_1.default.Transaction
            ? new mssql_1.default.Request(source)
            : new mssql_1.default.Request(source);
        const result = await request
            .input('id', mssql_1.default.Int, playStationId)
            .input('players', mssql_1.default.TinyInt, playersNumber)
            .query(`
        SELECT PlayersNumber, HourlyAmount, HalfHourAmount
        FROM dbo.PlayStationRates
        WHERE PlayStationID = @id AND PlayersNumber = @players;
      `);
        if (!result.recordset.length) {
            throw new Error(`No saved rate exists for ${playersNumber} player(s). Edit this console's rates in setup.`);
        }
        const row = result.recordset[0];
        return {
            PlayersNumber: Number(row.PlayersNumber),
            HourlyAmount: Number(row.HourlyAmount),
            HalfHourAmount: Number(row.HalfHourAmount)
        };
    }
    async getActiveSessionForUpdate(transaction, playStationId) {
        const result = await new mssql_1.default.Request(transaction)
            .input('id', mssql_1.default.Int, playStationId)
            .query(`
        SELECT TOP (1) * FROM dbo.Sessions WITH (UPDLOCK, ROWLOCK)
        WHERE PlayStationID = @id AND EndTime IS NULL ORDER BY SessionID DESC;
      `);
        if (!result.recordset.length)
            throw new Error('No active session was found for this console.');
        return result.recordset[0];
    }
    async updateSessionQuote(transaction, sessionId, players, duration, quote) {
        await new mssql_1.default.Request(transaction)
            .input('sessionId', mssql_1.default.BigInt, sessionId)
            .input('players', mssql_1.default.TinyInt, players)
            .input('duration', mssql_1.default.Int, duration)
            .input('hourlyRate', mssql_1.default.Decimal(10, 2), quote.HourlyRate)
            .input('halfHourRate', mssql_1.default.Decimal(10, 2), quote.HalfHourRate)
            .input('gross', mssql_1.default.Decimal(10, 2), quote.GrossAmount)
            .input('discountPercent', mssql_1.default.Decimal(5, 2), quote.DiscountPercent)
            .input('discountAmount', mssql_1.default.Decimal(10, 2), quote.DiscountAmount)
            .input('total', mssql_1.default.Decimal(10, 2), quote.TotalAmount)
            .input('perPerson', mssql_1.default.Decimal(10, 2), quote.PerPersonAmount)
            .query(`
        UPDATE dbo.Sessions
        SET PlayersNumber = @players, DurationMinutes = @duration, HourlyRate = @hourlyRate,
            HalfHourRate = @halfHourRate, GrossAmount = @gross, DiscountPercent = @discountPercent,
            DiscountAmount = @discountAmount, TotalAmount = @total, PerPersonAmount = @perPerson
        WHERE SessionID = @sessionId;
      `);
    }
    async close() {
        if (this.pool) {
            const pool = this.pool;
            this.pool = undefined;
            await pool.close();
        }
    }
}
exports.SqlServer = SqlServer;
