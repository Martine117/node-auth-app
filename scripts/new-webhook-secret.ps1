# Generate directly to clipboard. No secret is written to source or output.
$randomBytes = New-Object byte[] 32
$generator = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $generator.GetBytes($randomBytes)
    $webhookValue = -join ($randomBytes | ForEach-Object { $_.ToString('x2') })
    Set-Clipboard -Value $webhookValue
    Write-Output 'A new webhook secret was copied to the clipboard. Save it in your password manager, paste it into the GitHub webhook Secret field, and paste the SAME value into the hidden start-deploy.ps1 prompt.'
} finally {
    $generator.Dispose()
    $webhookValue = $null
    [Array]::Clear($randomBytes, 0, $randomBytes.Length)
}
