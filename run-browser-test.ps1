#!/usr/bin/env pwsh

<#
.SYNOPSIS
    LocalBuy Browser Test Runner for PowerShell

.DESCRIPTION
    Runs browser automation tests for the LocalBuy e-commerce application

.PARAMETER Visible
    Run with visible browser window

.PARAMETER Slow
    Run with 2 second delays between actions

.PARAMETER Debug
    Run with browser DevTools open

.PARAMETER SlowMo
    Custom delay in milliseconds between actions

.EXAMPLE
    .\run-browser-test.ps1 -Visible

.EXAMPLE
    .\run-browser-test.ps1 -Visible -Slow

.EXAMPLE
    .\run-browser-test.ps1 -Debug -SlowMo 1000
#>

[CmdletBinding()]
param(
    [switch]$Visible,
    [switch]$Slow,
    [switch]$Debug,
    [int]$SlowMo = 0
)

Write-Host "🚀 LocalBuy Browser Test Runner" -ForegroundColor Cyan
Write-Host ""

# Set environment variables based on parameters
if ($Visible -or $Debug) {
    $env:HEADLESS = "false"
} else {
    $env:HEADLESS = "true"
}

if ($Slow) {
    $env:SLOWMO = "2000"
} elseif ($SlowMo -gt 0) {
    $env:SLOWMO = $SlowMo.ToString()
} else {
    $env:SLOWMO = "0"
}

if ($Debug) {
    $env:DEVTOOLS = "true"
} else {
    $env:DEVTOOLS = "false"
}

Write-Host "🔧 Configuration:" -ForegroundColor Yellow
Write-Host "   Headless: $($env:HEADLESS)" -ForegroundColor Gray
Write-Host "   Slow Motion: $($env:SLOWMO)ms" -ForegroundColor Gray
Write-Host "   DevTools: $($env:DEVTOOLS)" -ForegroundColor Gray
Write-Host ""

try {
    node browser-test.js
    Write-Host ""
    Write-Host "✅ Browser test completed successfully!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "❌ Browser test failed: $_" -ForegroundColor Red
    exit 1
}