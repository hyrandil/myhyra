param(
    [Parameter(Mandatory=$true)][string]$ServerUrl,
    [Parameter(Mandatory=$true)][string]$EnrollmentToken
)

$ErrorActionPreference = 'Stop'

Write-Host "Starting Hyper-V Agent installation..."

$installRoot = "C:\\Program Files\\HyperVAgent"
$serviceName = "HyperVAgent"

if (-not (Test-Path $installRoot)) {
    New-Item -ItemType Directory -Path $installRoot | Out-Null
}

$agentConfigDir = "C:\\ProgramData\\HyperVAgent"
if (-not (Test-Path $agentConfigDir)) {
    New-Item -ItemType Directory -Path $agentConfigDir | Out-Null
}

$agentConfig = @{ ServerUrl = $ServerUrl; EnrollmentToken = $EnrollmentToken }
$agentConfig | ConvertTo-Json | Set-Content -Path (Join-Path $agentConfigDir 'agent.json')

# Placeholder: copy binaries (would be produced by build pipeline)
Copy-Item -Path "$PSScriptRoot\\..\\build\\*" -Destination $installRoot -Recurse -Force -ErrorAction SilentlyContinue

sc.exe create $serviceName binPath= "\"$installRoot\\HyperV.Agent.Service.exe\"" start= auto DisplayName= "Hyper-V Agent"
sc.exe description $serviceName "Hyper-V host integration agent"
Start-Service -Name $serviceName

Write-Host "Hyper-V Agent installation complete"
