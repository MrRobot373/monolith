@echo off
REM Force-stop the stack by port (use if the start window was closed abruptly).
node "%~dp0stop.mjs" %*
