param([Parameter(Mandatory=$true)][string]$DockerId)
if ($DockerId -notmatch '^[a-z0-9][a-z0-9_-]{1,38}$') { throw 'Enter your Docker Hub username, not an email or token.' }
$deployFolder = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..\auth-app-deploy'))
$envFile = Join-Path $deployFolder '.env'
if (-not (Test-Path -LiteralPath $envFile)) { throw 'Existing database configuration was not found; do not invent a new database password.' }
$configuration = [IO.File]::ReadAllLines($envFile) | Where-Object { $_ -notmatch '^DOCKERHUB_USERNAME=' }
[IO.File]::WriteAllLines($envFile, @($configuration) + "DOCKERHUB_USERNAME=$DockerId")
Write-Output 'Deployment username saved. Database credentials were retained and not displayed.'
