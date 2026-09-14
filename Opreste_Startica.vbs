' Oprire fara nicio fereastra de consola. Explicatia mecanismului este in
' Porneste_Startica.vbs.
Option Explicit

Dim shell, fso, folder, script, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)

' In pachetul pentru client lansatorii stau langa folderul Aplicatie.
script = folder & "\startica_desktop.ps1"
If fso.FileExists(folder & "\Aplicatie\startica_desktop.ps1") Then
    script = folder & "\Aplicatie\startica_desktop.ps1"
End If

command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & script & """ -Stop"

' 0 = fereastra ascunsa, False = nu asteptam terminarea.
shell.Run command, 0, False
