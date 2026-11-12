# PlayStation Manager — SQL Server Edition

Electron + React desktop application for managing a gaming lounge's PlayStation consoles, reservations, live session timers, console-specific pricing and billing.

## What's included

- Add each console with a custom name and type (PS3, PS4 or PS5).
- Configure a 1-hour and 30-minute **group total** for 1, 2, 3 and 4 players on every console.
- PS4 and PS5 starter prices match the supplied GRINDxGAMING rate card. PS3 starts at ₹0 because no PS3 rates were provided; enter the PS3 rates before using it.
- Click **Manage console** on the home card or click the console in the left sidebar to open the same console-management page.
- Live elapsed timers (HH:MM:SS) on the home cards, left sidebar and console-management page.
- One management screen per console. Available consoles show the reservation form; active consoles show the session information and a single **END SESSION** action.
- Reservation quote includes the applicable rates, subtotal, percentage discount, discount amount, final total and amount per person.
- Add players or extend a running session. The quote is recalculated using the saved rates.
- Session, rate and billing records are stored in Microsoft SQL Server.

## 1. Install SQL Server locally (Windows)

1. Install **SQL Server Express** or **SQL Server Developer** and install **SQL Server Management Studio (SSMS)**.
2. During SQL Server setup, note your server/instance name. A common Express instance is `localhost\SQLEXPRESS`; a default instance is usually `localhost`.
3. In SQL Server Configuration Manager, enable **TCP/IP** for the instance and restart the SQL Server service. For a named instance, either enable SQL Server Browser or assign a static TCP port.
4. Enable SQL Server Authentication / Mixed Mode if you plan to use a SQL login. Create a dedicated SQL login for the app (recommended) or use `sa` for a local-only setup. After running the schema, grant the app login `db_datareader` and `db_datawriter` on `PlayStationManager`. The app does not need database-owner privileges.

## 2. Create the database and tables

1. Open SSMS and connect to your local SQL Server instance.
2. Open `database/schema.sql` in a new query window.
3. Execute the script. It creates the `PlayStationManager` database and the following objects:
   - `dbo.PlayStations` — console identity, type, name and availability.
   - `dbo.PlayStationRates` — a separate hourly and half-hourly rate for each console and player count.
   - `dbo.Sessions` — reservation, start/end time, players, duration and a price/discount snapshot.
   - `dbo.Billing` — a permanent billing record when a session is ended.
   - `dbo.vw_DailyBilling` — daily revenue and discount summary view.

The schema also adds constraints and indexes to prevent duplicate active console names and multiple simultaneous sessions on one console.


Example SQL for a dedicated login (change the password before running it):

```sql
USE [master];
CREATE LOGIN [psmanager_app] WITH PASSWORD = N'ChangeThis_ToAStrongPassword!';
GO
USE [PlayStationManager];
CREATE USER [psmanager_app] FOR LOGIN [psmanager_app];
ALTER ROLE [db_datareader] ADD MEMBER [psmanager_app];
ALTER ROLE [db_datawriter] ADD MEMBER [psmanager_app];
GO
```

## 3. Configure the app connection

1. Copy `.env.example` to a new file named `.env` in the project root.
2. Update the connection values. For a default SQL Server instance using port 1433:

```env
SQL_SERVER=localhost
SQL_PORT=1433
SQL_INSTANCE=
SQL_USER=psmanager_app
SQL_PASSWORD=your_sql_login_password
SQL_DATABASE=PlayStationManager
SQL_ENCRYPT=false
SQL_TRUST_SERVER_CERTIFICATE=true
```

For SQL Server Express with a named instance, use the server host and instance name instead of a port, for example:

```env
SQL_SERVER=localhost
SQL_PORT=
SQL_INSTANCE=SQLEXPRESS
SQL_USER=psmanager_app
SQL_PASSWORD=your_sql_login_password
SQL_DATABASE=PlayStationManager
SQL_ENCRYPT=false
SQL_TRUST_SERVER_CERTIFICATE=true
```

Do not commit your real `.env` file. It is excluded by `.gitignore`.

## 4. Install and run the desktop app

Use Node.js 20 or newer and run these commands from the project folder:

```bash
npm install
npm run dev
```

To create the Windows installer:

```bash
npm run build
```

The installer is written under `release/`. In development, the app reads `.env` from the project root. After packaging, place the same `.env` file at `%APPDATA%\PlayStationManager\.env`; create the `PlayStationManager` folder under `%APPDATA%` if it does not exist.

## 5. First use

1. Open the app. The initial admin password is `password`.
2. Click the **+** beside **Your PlayStations**.
3. Enter a console name (for example `PS5 - TV 1`), select its type, review/edit the price matrix, enter the admin password and add it.
4. Open the console from the home screen or the left sidebar, select the player count and duration, apply an optional discount percentage, and reserve it.
5. The elapsed timer appears on the home card, the sidebar item and the console page. Open the console page to manage the session and end it.

## Pricing behaviour

- Price entries are **total amounts for the whole group**, matching the provided rate card.
- A 30-minute booking uses the 30-minute amount; each full hour uses the 1-hour amount. For example, a 90-minute booking is 1 × hourly rate + 1 × half-hour rate.
- Discount is applied to the calculated subtotal. The app displays and saves subtotal, discount amount, final total and per-person amount.
- The reserved quote is stored on the session. Adding players or extending time recalculates the quote and updates the session snapshot. Ending a session creates a billing row using the final saved quote.
- The timer measures actual elapsed time from the recorded start time; billing is based on the booked duration and selected rates, not the timer duration.

## Notes

- The SQL Server database is the source of truth. Local app storage is used only for the admin password.
- Console deletion is a soft delete so existing billing history remains intact.
- Database reset in Admin permanently deletes all console, session and billing records. Use it carefully.
- A running session is not automatically ended when its timer reaches the booked duration. The timer continues, and the operator ends the session from the console page.

## Fix for Electron `ERR_REQUIRE_ESM` on SQL Server startup

If Electron fails while loading `@typespec/ts-http-runtime` with an error saying that CommonJS `require()` cannot load `https-proxy-agent`, use the npm override in `package.json`. It pins the transitive `https-proxy-agent` used by `@typespec/ts-http-runtime` to CommonJS-compatible `7.0.6`; newer major versions (8/9) are ESM-only.

After extracting this updated project, open Command Prompt in the project folder and run:

```cmd
npm install
npm ls @typespec/ts-http-runtime https-proxy-agent
npm run dev
```

In the dependency tree, the `https-proxy-agent` directly beneath `@typespec/ts-http-runtime` should show `7.0.6`. The separate `https-proxy-agent@5.x` used by `electron-builder` may remain; that is expected. Do not edit files inside `node_modules` manually.
