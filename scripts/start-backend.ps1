$ErrorActionPreference = 'Stop'
$ktvRoot = Split-Path -Parent $PSScriptRoot
$ktvLocal = Join-Path $ktvRoot '.local'
New-Item -ItemType Directory -Path $ktvLocal -Force | Out-Null
$ktvAccess = Join-Path $ktvLocal 'access.json'
if (-not (Test-Path -LiteralPath $ktvAccess)) {
    $ktvRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $ktvBytes = New-Object byte[] 18
    $ktvRng.GetBytes($ktvBytes)
    $ktvAdminPassword = [Convert]::ToBase64String($ktvBytes)
    $ktvRng.GetBytes($ktvBytes)
    $ktvSupplierPassword = [Convert]::ToBase64String($ktvBytes)
    @{ admin = @{ username = 'ktv-admin'; password = $ktvAdminPassword }; supplier = @{ username = 'A01'; password = $ktvSupplierPassword } } | ConvertTo-Json | Set-Content -LiteralPath $ktvAccess -Encoding utf8
    $ktvRng.Dispose()
}
$ktvCredentials = Get-Content -LiteralPath $ktvAccess -Raw | ConvertFrom-Json
$env:KTV_BOOTSTRAP_ADMIN_PASSWORD = $ktvCredentials.admin.password
$env:KTV_BOOTSTRAP_SUPPLIER_PASSWORD = $ktvCredentials.supplier.password
$env:KTV_DEMO_PAYMENT_ENABLED = 'true'
$env:KTV_UPLOAD_PATH = Join-Path $ktvLocal 'uploads'
$env:SERVER_ADDRESS = '127.0.0.1'
$ktvParent = Split-Path -Parent $ktvRoot
$ktvBackend = $env:KTV_BACKEND_DIR
if (-not $ktvBackend) {
    $ktvBackend = Join-Path $ktvParent 'ktv-backend'
    if (-not (Test-Path -LiteralPath $ktvBackend)) { $ktvBackend = Join-Path $ktvParent 'RuoYi-Vue' }
}
$ktvPrivateConfig = Join-Path $ktvBackend '.local/application-private.yml'
if (Test-Path -LiteralPath $ktvPrivateConfig) {
    $env:SPRING_CONFIG_ADDITIONAL_LOCATION = ([Uri](Resolve-Path -LiteralPath $ktvPrivateConfig).Path).AbsoluteUri
}
$ktvJar = Join-Path $ktvBackend 'ruoyi-admin/target/ruoyi-admin.jar'
if (-not (Test-Path -LiteralPath $ktvJar)) { throw 'Build ktv-backend first: mvn -pl ruoyi-admin -am package -DskipTests' }
Write-Host 'Starting KTV API. Credentials: .local/access.json. Demo payment enabled.'
& java -jar $ktvJar
