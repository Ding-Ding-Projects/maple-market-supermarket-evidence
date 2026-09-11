$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$docs = Join-Path $root 'docs'
foreach ($required in @('index.html','styles.css','app.js','provenance.json')) {
  if (-not (Test-Path (Join-Path $docs $required))) { throw "Missing required public file: $required" }
}
$provenance = Get-Content (Join-Path $docs 'provenance.json') -Raw | ConvertFrom-Json
if ($provenance.captures.Count -ne 4) { throw 'Expected exactly four public captures.' }
$publicText = Get-ChildItem $docs -File -Recurse | Where-Object { $_.Extension -in '.html','.css','.js','.json','.md' } | Get-Content -Raw
foreach ($needle in @('restroom','room','caller','credential','password','token','protected source','private operational','diagnostic')) {
  if ($publicText -match [regex]::Escape($needle)) { throw "Privacy scan found forbidden public text: $needle" }
}
foreach ($capture in $provenance.captures) {
  $path = Join-Path $docs $capture.file
  if (-not (Test-Path $path)) { throw "Missing capture: $($capture.file)" }
  $hash = (Get-FileHash $path -Algorithm SHA256).Hash
  if ($hash -ne $capture.sha256) { throw "Hash mismatch: $($capture.file)" }
  if ((Get-Item $path).Length -ne $capture.bytes) { throw "Byte count mismatch: $($capture.file)" }
}
Write-Output "Public bundle valid: $($provenance.captures.Count) captures, privacy scan clear, hashes verified."
