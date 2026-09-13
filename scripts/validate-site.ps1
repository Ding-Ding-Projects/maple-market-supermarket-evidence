$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$docs = Join-Path $root 'docs'
foreach ($required in @('index.html','styles.css','app.js','copy-description.js','provenance.json')) {
  if (-not (Test-Path (Join-Path $docs $required))) { throw "Missing required public file: $required" }
}
$provenance = Get-Content (Join-Path $docs 'provenance.json') -Raw | ConvertFrom-Json
if ($provenance.schemaVersion -ne 2) { throw 'Expected provenance schema version 2.' }
if ($provenance.captures.Count -lt 1) { throw 'Expected at least one public capture.' }
if ($null -eq $provenance.thumbnail) { throw 'Expected a reviewed public thumbnail.' }
$publicText = Get-ChildItem $docs -File -Recurse | Where-Object { $_.Extension -in '.html','.css','.js','.json','.md' } | Get-Content -Raw
foreach ($needle in @('\brestroom\b','\broom\b','\bcaller\b','\bcredential\b','\bpassword\b','\btoken\b','protected source','private operational','\bdiagnostic\b')) {
  if ($publicText -match $needle) { throw "Privacy scan found forbidden public text: $needle" }
}
foreach ($capture in $provenance.captures) {
  $path = Join-Path $docs $capture.file
  if (-not (Test-Path $path)) { throw "Missing capture: $($capture.file)" }
  $hash = (Get-FileHash $path -Algorithm SHA256).Hash
  if ($hash -ne $capture.sha256) { throw "Hash mismatch: $($capture.file)" }
  if ((Get-Item $path).Length -ne $capture.bytes) { throw "Byte count mismatch: $($capture.file)" }
}
$thumbnailPath = Join-Path $docs $provenance.thumbnail.file
if (-not (Test-Path $thumbnailPath)) { throw "Missing thumbnail: $($provenance.thumbnail.file)" }
$thumbnailHash = (Get-FileHash $thumbnailPath -Algorithm SHA256).Hash
if ($thumbnailHash -ne $provenance.thumbnail.sha256) { throw 'Thumbnail hash mismatch.' }
if ((Get-Item $thumbnailPath).Length -ne $provenance.thumbnail.bytes) { throw 'Thumbnail byte count mismatch.' }
$listed = @($provenance.captures.file + $provenance.thumbnail.file | ForEach-Object { [IO.Path]::GetFullPath((Join-Path $docs $_)) })
$actual = @(Get-ChildItem (Join-Path $docs 'images') -File -Recurse | Select-Object -ExpandProperty FullName)
$difference = Compare-Object (@($listed | Sort-Object)) (@($actual | Sort-Object))
if ($null -ne $difference) { throw 'Image directory does not exactly match the provenance manifest.' }
Write-Output "Public bundle valid: $($provenance.captures.Count) captures, privacy scan clear, hashes verified."
