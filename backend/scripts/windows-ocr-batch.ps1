param(
  [Parameter(Mandatory = $true)][string]$ImageDirectory,
  [Parameter(Mandatory = $true)][string]$OutputJson
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$storageFileType = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$fileAccessModeType = [Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime]
$bitmapDecoderType = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$softwareBitmapType = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics, ContentType = WindowsRuntime]
$randomAccessStreamType = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage, ContentType = WindowsRuntime]
$ocrEngineType = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$ocrResultType = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType = WindowsRuntime]
$languageType = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]

function Wait-WinRtOperation($operation, [Type]$resultType) {
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
      $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and
      $_.GetParameters().Count -eq 1 -and
      $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } | Select-Object -First 1
  if (-not $method) { throw 'Could not find the WinRT async bridge.' }
  $closedMethod = $method.MakeGenericMethod($resultType)
  $task = $closedMethod.Invoke($null, @($operation))
  return $task.GetAwaiter().GetResult()
}

$engine = $ocrEngineType::TryCreateFromLanguage([Activator]::CreateInstance($languageType, @('en-US')))
if (-not $engine) { throw 'Windows OCR does not have an English recognizer available.' }

$results = @()
Get-ChildItem -LiteralPath $ImageDirectory -Filter '*.png' -File | Sort-Object Name | ForEach-Object {
  $storageFile = Wait-WinRtOperation ($storageFileType::GetFileFromPathAsync($_.FullName)) $storageFileType
  $stream = Wait-WinRtOperation ($storageFile.OpenAsync($fileAccessModeType::Read)) $randomAccessStreamType
  try {
    $decoder = Wait-WinRtOperation ($bitmapDecoderType::CreateAsync($stream)) $bitmapDecoderType
    $bitmap = Wait-WinRtOperation ($decoder.GetSoftwareBitmapAsync()) $softwareBitmapType
    try {
      $recognized = Wait-WinRtOperation ($engine.RecognizeAsync($bitmap)) $ocrResultType
      $results += [pscustomobject]@{ name = $_.Name; text = $recognized.Text }
    }
    finally {
      $bitmap.Dispose()
    }
  }
  finally {
    $stream.Dispose()
  }
}

$results | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $OutputJson -Encoding UTF8
