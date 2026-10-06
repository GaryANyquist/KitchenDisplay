/*
 * One-time setup for the Kitchen Display. Run in SSMS as an administrator,
 * after the register schema (kfdisplay-sync setup/02) is in place.
 *
 * Creates:
 *   - dbo.kitchen_line_done: which ticket lines the kitchen has ticked off.
 *     (A separate table, so the register's synced tables are never changed.)
 *   - login kitchen_display: reads the orders and menu, and may only change
 *     orders.order_up_at / orders.completed_at and its own table.
 *
 * Before running: replace CHANGE_ME with a strong password (it goes in the
 * Kitchen Display's .env as DB_PASSWORD, nowhere else). Safe to run again.
 */

USE [master];
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'kitchen_display')
    CREATE LOGIN kitchen_display WITH PASSWORD = N'CHANGE_ME', CHECK_POLICY = ON, DEFAULT_DATABASE = [KFDisplay];
ELSE
    ALTER LOGIN kitchen_display WITH PASSWORD = N'CHANGE_ME';
GO

USE [KFDisplay];
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'kitchen_display')
    CREATE USER kitchen_display FOR LOGIN kitchen_display;
GO

IF OBJECT_ID(N'dbo.kitchen_line_done', N'U') IS NULL
    CREATE TABLE dbo.kitchen_line_done (
        line_uid  nvarchar(64) NOT NULL PRIMARY KEY,
        done_at   datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME()
    );
GO

GRANT SELECT ON dbo.orders               TO kitchen_display;
GRANT SELECT ON dbo.order_lines          TO kitchen_display;
GRANT SELECT ON dbo.order_line_modifiers TO kitchen_display;
GRANT SELECT ON dbo.items                TO kitchen_display;
GRANT SELECT ON dbo.categories           TO kitchen_display;
GRANT UPDATE (order_up_at, completed_at) ON dbo.orders TO kitchen_display;
GRANT SELECT, INSERT, DELETE ON dbo.kitchen_line_done TO kitchen_display;
GO

PRINT N'kitchen_display can read the register tables and bump orders, and nothing else.';
