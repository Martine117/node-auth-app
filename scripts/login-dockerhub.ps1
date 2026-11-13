param([Parameter(Mandatory=$true)][string]$DockerId)
# Use only the read-only local-deploy token here; never a Docker password.
$tokenInput = Read-Host 'Docker Hub local-deploy token (hidden)' -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokenInput)
try {
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer) | docker login --username $DockerId --password-stdin
    if ($LASTEXITCODE -ne 0) { throw 'Docker Hub login failed.' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
}
