@echo off
echo 🚀 LocalBuy Browser Test Runner
echo.

if "%1"=="--help" (
    echo Usage: run-browser-test.bat [options]
    echo.
    echo Options:
    echo   --visible     Run with visible browser
    echo   --slow        Run with 2 second delays
    echo   --debug       Run with DevTools open
    echo   --help        Show this help
    echo.
    echo Examples:
    echo   run-browser-test.bat --visible
    echo   run-browser-test.bat --slow
    echo   run-browser-test.bat --visible --slow
    goto :eof
)

set HEADLESS=true
set SLOWMO=0
set DEVTOOLS=false

:parse
if "%1"=="--visible" (
    set HEADLESS=false
    shift
    goto :parse
)
if "%1"=="--slow" (
    set SLOWMO=2000
    shift
    goto :parse
)
if "%1"=="--debug" (
    set HEADLESS=false
    set DEVTOOLS=true
    shift
    goto :parse
)
if not "%1"=="" (
    shift
    goto :parse
)

echo 🔧 Configuration:
echo    Headless: %HEADLESS%
echo    Slow Motion: %SLOWMO%ms
echo    DevTools: %DEVTOOLS%
echo.

node browser-test.js