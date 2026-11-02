$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $docPath = "A:\Projects\Mitra Clone\MITRA_Research_Paper_IRJMETS_5pages_Final.docx"
    $doc = $word.Documents.Open($docPath)
    $pages = $doc.ComputeStatistics(2) # 2 = wdStatisticPages
    Write-Host "WORD ACTUAL PAGE COUNT: $pages"
    
    # Also save as PDF to see exactly where page breaks occur
    $pdfPath = "A:\Projects\Mitra Clone\deliverables\MITRA_Paper_Check.pdf"
    $doc.SaveAs([ref]$pdfPath, [ref]17) # 17 = wdFormatPDF
    Write-Host "SAVED PDF TO: $pdfPath"
    $doc.Close([ref]$false)
} catch {
    Write-Host "Error: $_"
} finally {
    $word.Quit()
}

