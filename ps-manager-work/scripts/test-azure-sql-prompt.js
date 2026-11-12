/**
 * Interactive Azure SQL login test.
 * Asks for the password in the terminal (not from .env) to isolate credential issues.
 *
 * Usage: node scripts/test-azure-sql-prompt.js
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
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

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const stdin = process.stdin;
    const onData = (char) => {
      char = char.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
      } else if (char === '\u0003') {
        process.exit(1);
      } else {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(question + '*'.repeat(rl.line.length));
      }
    };
    stdin.on('data', onData);
    rl.question(question, (value) => {
      rl.close();
      resolve(value);
    });
  });
}

(async () => {
  const server = process.env.SQL_SERVER;
  const user = process.env.SQL_USER || 'grindxgaming';
  const database = process.env.SQL_DATABASE || 'PlayStationManager';

  console.log('Azure SQL interactive login test');
  console.log({ server, user, database });
  console.log('Enter the SQL admin password from Azure Portal (Reset password).');
  console.log('This does NOT read SQL_PASSWORD from .env.\n');

  const password = await askHidden('SQL password: ');
  if (!password) {
    console.error('No password entered.');
    process.exit(1);
  }

  const config = {
    server,
    port: 1433,
    user,
    password,
    database: 'master',
    connectionTimeout: 30000,
    options: {
      encrypt: true,
      trustServerCertificate: false,
      enableArithAbort: true,
    },
  };

  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const result = await pool.request().query(
      'SELECT SUSER_SNAME() AS loginName, DB_NAME() AS dbName',
    );
    console.log('SUCCESS against master:', result.recordset[0]);
    await pool.close();

    config.database = database;
    const pool2 = await new sql.ConnectionPool(config).connect();
    const result2 = await pool2.request().query(
      'SELECT SUSER_SNAME() AS loginName, DB_NAME() AS dbName',
    );
    console.log(`SUCCESS against ${database}:`, result2.recordset[0]);
    await pool2.close();

    console.log('\nPassword is correct. Put this exact password in .env as SQL_PASSWORD and restart the app.');
    process.exit(0);
  } catch (error) {
    console.error('\nFAIL:', error.code, error.message);
    console.error('\nThat password is not accepted by Azure for login', user);
    console.error('In Azure Portal → SQL server grindxgaming-sql → Reset password,');
    console.error('set a NEW password, wait ~1 minute, then run this script again with the new password.');
    process.exit(1);
  }
})();
