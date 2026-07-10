@echo off
REM Start the whole stack (Ollama + engine + UI) and open the browser.
REM Leave this window open; press Ctrl+C to stop everything.
node "%~dp0start.mjs" %*
