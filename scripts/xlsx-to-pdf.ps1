# Renders workbooks to PDF with Excel so a generated spreadsheet can be looked at before shipping a change to an export.
# Usage: .\scripts\xlsx-to-pdf.ps1 -Files C:\path\KPO-2026.xlsx   (writes KPO-2026.pdf next to it)
param([string[]]$Files)
$excel = New-Object -ComObject Excel.Application
try {
  $excel.Visible = $false; $excel.DisplayAlerts = $false
  foreach ($file in $Files) {
    $pdf = [System.IO.Path]::ChangeExtension($file, ".pdf")
    if (Test-Path $pdf) { Remove-Item $pdf -Confirm:$false }
    $wb = $excel.Workbooks.Open($file, 0, $true)
    $wb.ExportAsFixedFormat(0, $pdf)
    $wb.Close($false)
    "exported " + $pdf
  }
} finally { $excel.Quit(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
