/**
 * Tries several Azure SQL connection styles to match what SSMS can do.
 */
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
  process.env[key] = value;
}

const server = process.env.SQL_SERVER;
const user = process.env.SQL_USER;
const password = process.env.SQL_PASSWORD;
const database = process.env.SQL_DATABASE || 'PlayStationManager';
const serverName = server.replace(/\.database\.windows\.net$/i, '');

const variants = [
  {
    name: 'mssql-config-object',
    config: {
      server,
      port: 1433,
      user,
      password,
      database,
      connectionTimeout: 30000,
      options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
    },
  },
  {
    name: 'mssql-trust-cert',
    config: {
      server,
      port: 1433,
      user,
      password,
      database,
      connectionTimeout: 30000,
      options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
    },
  },
  {
    name: 'mssql-user-at-server',
    config: {
      server,
      port: 1433,
      user: `${user}@${serverName}`,
      password,
      database,
      connectionTimeout: 30000,
      options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
    },
  },
  {
    name: 'mssql-master-db',
    config: {
      server,
      port: 1433,
      user,
      password,
      database: 'master',
      connectionTimeout: 30000,
      options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
    },
  },
  {
    name: 'tedious-authentication-object',
    config: {
      server,
      database,
      connectionTimeout: 30000,
      authentication: {
        type: 'default',
        options: { userName: user, password },
      },
      options: {
        port: 1433,
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true,
      },
    },
  },
  {
    name: 'ado-connection-string',
    config: `Server=tcp:${server},1433;Database=${database};User ID=${user};Password=${password};Encrypt=true;TrustServerCertificate=false;Connection Timeout=30;`,
  },
  {
    name: 'ado-connection-string-braced-password',
    config: `Server=tcp:${server},1433;Database=${database};User ID=${user};Password={${password}};Encrypt=true;TrustServerCertificate=false;Connection Timeout=30;`,
  },
  {
    name: 'ado-connection-string-master',
    config: `Server=tcp:${server},1433;Database=master;User ID=${user};Password={${password}};Encrypt=true;TrustServerCertificate=false;Connection Timeout=30;`,
  },
];

async function tryVariant(variant) {
  let pool;
  try {
    pool = await sql.connect(variant.config);
    const result = await pool.request().query(
      'SELECT SUSER_SNAME() AS loginName, DB_NAME() AS dbName, @@VERSION AS version',
    );
    console.log('SUCCESS:', variant.name, {
      loginName: result.recordset[0].loginName,
      dbName: result.recordset[0].dbName,
      version: String(result.recordset[0].version).split('\n')[0],
    });
    return true;
  } catch (error) {
    console.log('FAIL:', variant.name, {
      code: error.code,
      message: error.message,
      original: error.originalError?.message,
    });
    return false;
  } finally {
    try {
      if (pool) await pool.close();
    } catch {
      /* ignore */
    }
    try {
      await sql.close();
    } catch {
      /* ignore */
    }
  }
}

(async () => {
  console.log('Password fingerprint:', {
    length: password.length,
    charCodes: [...password].map((c) => c.charCodeAt(0)),
  });
  console.log('Trying connection variants against', server, '...\n');

  for (const variant of variants) {
    if (await tryVariant(variant)) {
      console.log('\nWorking variant:', variant.name);
      process.exit(0);
    }
  }

  console.error('\nNo variant worked.');
  console.error('In SSMS, please confirm the connection dialog shows:');
  console.error('  Server name: grindxgaming-sql.database.windows.net');
  console.error('  Authentication: SQL Server Authentication (NOT Microsoft Entra)');
  console.error('  Login: grindxgaming');
  process.exit(1);
})();
