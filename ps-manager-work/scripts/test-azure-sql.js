const fs = require('fs');
const path = require('path');
const sql = require('mssql');

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
  if (process.env[key] === undefined) process.env[key] = value;
}

const server = process.env.SQL_SERVER;
const baseUser = process.env.SQL_USER || '';
const password = process.env.SQL_PASSWORD || '';
const database = process.env.SQL_DATABASE || 'PlayStationManager';
const serverName = server.replace(/\.database\.windows\.net$/i, '');

const users = [...new Set([
  baseUser,
  baseUser.includes('@') ? baseUser : `${baseUser}@${serverName}`,
])];

async function tryConnect(user, dbName) {
  const config = {
    server,
    port: 1433,
    user,
    password,
    database: dbName,
    connectionTimeout: 20000,
    options: {
      encrypt: true,
      trustServerCertificate: false,
      enableArithAbort: true,
    },
  };

  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    const result = await pool.request().query(
      'SELECT SUSER_SNAME() AS loginName, DB_NAME() AS dbName',
    );
    console.log('SUCCESS', { user, database: dbName, result: result.recordset[0] });
    return true;
  } catch (error) {
    console.log('FAIL', {
      user,
      database: dbName,
      code: error.code,
      message: error.message,
    });
    return false;
  } finally {
    try { await pool.close(); } catch { /* ignore */ }
  }
}

(async () => {
  console.log('Testing Azure SQL auth variants...', {
    server,
    passwordLength: password.length,
    users,
  });

  for (const user of users) {
    for (const dbName of [database, 'master']) {
      if (await tryConnect(user, dbName)) process.exit(0);
    }
  }

  console.error('\nAll login attempts failed.');
  console.error('Check in Azure Portal:');
  console.error('1) SQL server → Reset password (must match .env SQL_PASSWORD)');
  console.error('2) SQL server → Microsoft Entra ID → disable "Support only Microsoft Entra authentication" if enabled');
  console.error('3) SQL server → Networking → your client IP is allowed');
  process.exit(1);
})();
