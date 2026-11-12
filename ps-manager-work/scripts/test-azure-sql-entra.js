/**
 * Connect to Azure SQL using Microsoft Entra (device code login).
 * This matches what SSMS often uses when "Microsoft Entra MFA" is selected.
 *
 * Usage: node scripts/test-azure-sql-entra.js
 */
const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const { DeviceCodeCredential } = require('@azure/identity');

const envPath = path.resolve(__dirname, '..', '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const separator = trimmed.indexOf('=');
  if (separator < 1) continue;
  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const server = process.env.SQL_SERVER;
const database = process.env.SQL_DATABASE || 'PlayStationManager';
const tenantId = process.env.AZURE_TENANT_ID || '2b376bbc-3b55-4b60-9061-504e6cca47f0';

(async () => {
  console.log('Microsoft Entra device-code login for Azure SQL');
  console.log({ server, database, tenantId });
  console.log('Use the same Microsoft account that works in SSMS (csadarsh29@gmail.com).\n');

  const credential = new DeviceCodeCredential({
    tenantId,
    userPromptCallback: (info) => {
      console.log(info.message);
    },
  });

  const token = await credential.getToken('https://database.windows.net/.default');
  if (!token?.token) {
    throw new Error('No access token returned from Microsoft Entra.');
  }

  const config = {
    server,
    database,
    port: 1433,
    connectionTimeout: 30000,
    authentication: {
      type: 'azure-active-directory-access-token',
      options: { token: token.token },
    },
    options: {
      encrypt: true,
      trustServerCertificate: false,
      enableArithAbort: true,
    },
  };

  const pool = await new sql.ConnectionPool(config).connect();
  const result = await pool.request().query(
    'SELECT SUSER_SNAME() AS loginName, DB_NAME() AS dbName',
  );
  console.log('\nSUCCESS with Microsoft Entra:', result.recordset[0]);
  await pool.close();
})().catch((error) => {
  console.error('\nFAIL:', error.code || '', error.message);
  process.exit(1);
});
