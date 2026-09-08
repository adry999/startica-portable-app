' Oprire fara nicio fereastra de consola. Explicatia mecanismului este in
' Porneste_Startica.vbs.
Option Explicit

Dim shell, fso, folder, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)

command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & _
    folder & "\startica_desktop.ps1"" -Stop"

' 0 = fereastra ascunsa, False = nu asteptam terminarea.
shell.Run command, 0, False
