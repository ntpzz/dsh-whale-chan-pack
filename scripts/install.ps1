# Installer for the dsh-whale-pack 整合包 (plugins into a dsh web profile).
# Installs: dsh-status-rotator, dsh-deep-whale (manager + maid-atelier + orca-link),
#           dsh-pilot browser control. Then enables skin-manager + maid-atelier
#           (disables orca-link) and seeds status-rotator config.
# Requires: node, pnpm (>=9), a configured `dsh web` profile, git + network.
param(
  [string]$ProfileName = "web",
  [switch]$SkipBrowserControl
)

$ErrorActionPreference = "Stop"
$homeDsh = Join-Path $env:USERPROFILE ".dsh"
$profileDir = Join-Path (Join-Path $homeDsh "profiles") $ProfileName
$pkgPath = Join-Path $profileDir "package.json"

if (-not (Test-Path $pkgPath)) { throw "profile not found: $profileDir (run `dsh web` once first?)" }
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) { throw "pnpm not found on PATH. Install it first:  npm i -g pnpm@9" }
$node = (Get-Command node).Source
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$packs = @(
  @{ spec = (Join-Path $repoRoot "plugins\dsh-whale-meter"); bundle = "dsh-whale-meter" }
  @{ spec = (Join-Path $repoRoot "plugins\dsh-whale-voice");  bundle = "dsh-whale-voice" }
  @{ spec = "dsh-status-rotator";                            bundle = "dsh-status-rotator" }
  @{ spec = "github:guo6x/dsh-pilot";                         bundle = "dsh-pilot" }
  @{ spec = "github:Small-tailqwq/dsh-deep-whale#path:/skin-manager"; bundle = "@dsh-external/dsh-client-ui-skin-deep-whale-manager" }
  @{ spec = "github:Small-tailqwq/dsh-deep-whale#path:/maid-atelier"; bundle = "@dsh-external/dsh-client-ui-skin-maid-atelier" }
  @{ spec = "github:Small-tailqwq/dsh-deep-whale#path:/orca-link";   bundle = "@dsh-external/dsh-client-ui-skin-orca-link" }
)
if ($SkipBrowserControl) { $packs = $packs | Where-Object { $_.bundle -ne "dsh-pilot" } }

Write-Host ">> Installing plugins into profile '$ProfileName'"
Push-Location $profileDir
try {
  foreach ($p in $packs) {
    Write-Host ("-- add " + $p.spec)
    & $pnpm.Source add -w $p.spec
    if ($LASTEXITCODE -ne 0) { throw ("pnpm add failed: " + $p.spec) }
  }
} finally { Pop-Location }

# Register every bundle in dsh.profile.bundles (deps were added by pnpm above).
$names = ($packs | ForEach-Object { $_.bundle }) -join ","
& $node -e "const fs=require('fs');const f=process.argv[1];const j=JSON.parse(fs.readFileSync(f,'utf8'));for(const n of process.argv[2].split(',')){if(n&&!j.dsh.profile.bundles.includes(n))j.dsh.profile.bundles.push(n)}fs.writeFileSync(f,JSON.stringify(j,null,2)+String.fromCharCode(10));" -- $pkgPath $names

# Skin mutual exclusion: keep manager + maid-atelier; disable orca-link.
$rows = @("- id: ui-skin-maid-atelier`n  disabled: false`n- id: ui-skin-orca-link`n  disabled: true`n- id: ui-skin-deep-whale-manager`n  disabled: false`n")
foreach ($f in @((Join-Path $profileDir "cordis.patch.yml"), (Join-Path $homeDsh "cordis.patch.yml"))) {
  Set-Content -Path $f -Value ($rows) -Encoding utf8 -NoNewline
}

# Seed status-rotator config.json (default phrase bank) if it is missing.
$sr = Join-Path $profileDir "node_modules\dsh-status-rotator"
if (Test-Path (Join-Path $sr "config.example.json")) {
  if (-not (Test-Path (Join-Path $sr "config.json"))) {
    Copy-Item (Join-Path $sr "config.example.json") (Join-Path $sr "config.json") -Force
  }
}

Write-Host ">> Done. Restart dsh once:  dsh --profile $ProfileName"

# Install the single supported desktop client and create its Desktop shortcut.
$electronDir = Join-Path $repoRoot "electron-client"
$electronExe = Join-Path $electronDir "node_modules\electron\dist\electron.exe"
if (-not (Test-Path $electronExe)) {
  Write-Host ">> Installing Electron client dependencies"
  Push-Location $electronDir
  try {
    & (Get-Command npm).Source ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed for electron-client" }
  } finally { Pop-Location }
}
if (-not (Test-Path $electronExe)) { throw "Electron executable was not installed: $electronExe" }

$desktop = [Environment]::GetFolderPath("Desktop")
$oldLauncher = Join-Path $desktop "DeepSeek Harness.exe"
if (Test-Path $oldLauncher) { Remove-Item -LiteralPath $oldLauncher -Force }
$shortcutPath = Join-Path $desktop "DeepSeek Harness.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $electronExe
$shortcut.Arguments = ('"' + $electronDir + '"')
$shortcut.WorkingDirectory = $electronDir
$shortcut.IconLocation = (Join-Path $electronDir "whale.ico")
$shortcut.Description = "DeepSeek Harness Electron client"
$shortcut.Save()

Write-Host "   已创建桌面快捷方式：DeepSeek Harness（Electron 客户端）。"
