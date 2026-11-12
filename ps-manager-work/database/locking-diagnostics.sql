

-- Identify blocking queries
SELECT
    r.session_id,
    r.blocking_session_id,
    r.status,
    r.wait_type,
    r.wait_time AS wait_time_ms,
    r.wait_resource,
    DB_NAME(r.database_id) AS database_name,
    s.host_name,
    s.program_name,
    s.login_name,
    txt.text AS sql_text
FROM sys.dm_exec_requests r
JOIN sys.dm_exec_sessions s
    ON r.session_id = s.session_id
OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) txt
WHERE r.database_id = DB_ID('PlayStationManager')
ORDER BY r.blocking_session_id DESC;

-- Check open transactions
DBCC OPENTRAN('PlayStationManager');
GO
