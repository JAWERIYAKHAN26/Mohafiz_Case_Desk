# Run this only after SQL setup, credentials and preview have been checked.
# Creates a daily local Windows task. The computer must be on and this user logged in.
$archiveProject = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$archiveEnvironment = Join-Path $archiveProject '.env.archive.local'
if (-not (Test-Path -LiteralPath $archiveEnvironment)) { throw 'Create private .env.archive.local first. See TEN_DAY_ARCHIVE_SETUP.md.' }
$archiveNode = (Get-Command node -ErrorAction Stop).Source
$archiveArguments = '--env-file="' + $archiveEnvironment + '" "' + (Join-Path $PSScriptRoot 'run.mjs') + '" --commit'
$archiveAction = New-ScheduledTaskAction -Execute $archiveNode -Argument $archiveArguments -WorkingDirectory $archiveProject
$archiveTrigger = New-ScheduledTaskTrigger -Daily -At '03:00'
$archiveSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 6)
$archiveIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$archivePrincipal = New-ScheduledTaskPrincipal -UserId $archiveIdentity -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'Mohafiz - Archive Closed Cases After 10 Days' -Action $archiveAction -Trigger $archiveTrigger -Settings $archiveSettings -Principal $archivePrincipal -Description 'Verified spreadsheet and JSON archive, then guarded deletion after ten-day closure retention.' -Force
