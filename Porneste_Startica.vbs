' Pornire fara nicio fereastra de consola.
'
' powershell.exe isi creeaza intotdeauna o consola si abia apoi o ascunde, deci
' -WindowStyle Hidden tot lasa o licarire. Lansat prin cmd.exe, licaririle sunt
' doua. wscript.exe nu are consola deloc, iar Run(..., 0, False) porneste
' procesul ascuns din prima, fara nimic vizibil.
Option Explicit

Dim shell, fso, folder, command, argument, index
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)

command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & _
    folder & "\startica_desktop.ps1"""

' Argumentele primite (-Stop, -Port 8765) se trimit mai departe. Cele care
' contin spatii se citeaza, ca o cale sa nu fie rupta in doua.
For index = 0 To WScript.Arguments.Count - 1
    argument = WScript.Arguments(index)
    If InStr(argument, " ") > 0 Then
        command = command & " """ & argument & """"
    Else
        command = command & " " & argument
    End If
Next

' 0 = fereastra ascunsa, False = nu asteptam terminarea.
shell.Run command, 0, False
