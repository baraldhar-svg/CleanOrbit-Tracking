Add-Type -AssemblyName System.Drawing

$dir = "c:\Users\DELL\Desktop\clean-bustracker\CleanOrbit-Tracking\apps\webview-app\assets"
$files = @("adaptive-icon.png", "icon.png", "splash.png")

foreach ($file in $files) {
    $path = Join-Path $dir $file
    if (Test-Path $path) {
        try {
            $img = [System.Drawing.Image]::FromFile($path)
            if ($img.RawFormat.Guid -eq [System.Drawing.Imaging.ImageFormat]::Jpeg.Guid) {
                Write-Host "$file is JPEG, converting to PNG..."
                $tempPath = $path + ".tmp.png"
                $img.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
                $img.Dispose()
                Remove-Item $path
                Rename-Item -Path $tempPath -NewName $file
                Write-Host "Converted $file to PNG"
            } else {
                $img.Dispose()
                Write-Host "$file is already PNG or not JPEG"
            }
        } catch {
            Write-Host "Error processing file."
        }
    }
}
