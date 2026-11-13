# Enter the same secret used in GitHub's webhook form. Input is hidden.
$webhookInput = Read-Host 'Webhook secret (hidden)' -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($webhookInput)
try {
    $env:WEBHOOK_SECRET = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    $env:COMPOSE_FILE = Join-Path $PSScriptRoot 'docker-compose.deploy.yml'
    python (Join-Path $PSScriptRoot 'deploy_server.py')
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    Remove-Item Env:WEBHOOK_SECRET -ErrorAction SilentlyContinue
}
