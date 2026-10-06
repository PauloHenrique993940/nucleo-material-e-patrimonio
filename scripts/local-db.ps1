param([ValidateSet('start', 'stop', 'status')][string]$Action = 'status')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$databaseDirectory = Join-Path $projectRoot '.artifacts/postgres-local'
$pgCtl = 'C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe'
if (!(Test-Path -LiteralPath $pgCtl)) { throw 'PostgreSQL 18 não encontrado.' }
if (!(Test-Path -LiteralPath (Join-Path $databaseDirectory 'PG_VERSION'))) {
  throw 'A instância local recuperada não existe. Este comando não inicializa nem apaga bancos.'
}
switch ($Action) {
  'start' {
    & $pgCtl -D $databaseDirectory status *> $null
    if ($LASTEXITCODE -eq 0) { Write-Output 'PostgreSQL local já está em execução.'; exit 0 }
    & $pgCtl -D $databaseDirectory -l (Join-Path $projectRoot '.artifacts/postgres-local.log') -o '-p 15432 -h 127.0.0.1' -w start
  }
  'stop' { & $pgCtl -D $databaseDirectory -m fast -w stop }
  'status' { & $pgCtl -D $databaseDirectory status }
}
exit $LASTEXITCODE
