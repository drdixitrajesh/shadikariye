param([string]$SigningDirectory='C:/Users/Dr. Rajesh/.codex/integrations/vedik-milan-android')
$ErrorActionPreference='Stop'
$repoRoot=Split-Path $PSScriptRoot -Parent
$env:JAVA_HOME=Join-Path $repoRoot 'work/android-tools/java/jdk-21.0.13+9'
$env:ANDROID_HOME=Join-Path $repoRoot 'work/android-tools/sdk'
$env:GRADLE_USER_HOME=Join-Path $repoRoot 'work/android-tools/gradle-cache'
$env:VEDIK_KEYSTORE=Join-Path $SigningDirectory 'release.p12'
$secret=(Get-Content -LiteralPath (Join-Path $SigningDirectory 'store-password.dpapi') -Raw).Trim() | ConvertTo-SecureString
$env:VEDIK_STORE_PASSWORD=[System.Net.NetworkCredential]::new('', $secret).Password
Push-Location (Join-Path $PSScriptRoot 'android')
try {
 & (Join-Path $repoRoot 'work/android-tools/gradle/gradle-8.13/bin/gradle.bat') --no-daemon --console=plain wrapper --no-validate-url --gradle-version 8.13 --distribution-type bin assembleRelease bundleRelease lintRelease
 if($LASTEXITCODE){throw 'Android release build failed. See the build log.'}
} finally {Pop-Location; Remove-Item Env:VEDIK_STORE_PASSWORD; Remove-Item Env:VEDIK_KEYSTORE}
