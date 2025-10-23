$serviceName = "HyperVAgent"

if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    sc.exe delete $serviceName | Out-Null
}

$installRoot = "C:\\Program Files\\HyperVAgent"
if (Test-Path $installRoot) {
    Remove-Item -Path $installRoot -Recurse -Force
}

Write-Host "Hyper-V Agent removed."
