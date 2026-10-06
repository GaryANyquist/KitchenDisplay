@echo off
rem Starts the Kitchen Display server and appends its output to logs\kitchen.log.
rem Used by the "Kitchen Display" scheduled task (see README); also fine to double-click.
cd /d "%~dp0"
if not exist logs mkdir logs
node src\main.js >> logs\kitchen.log 2>&1
