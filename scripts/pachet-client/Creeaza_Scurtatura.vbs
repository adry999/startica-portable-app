' Creeaza pe Desktop scurtatura Startica, cu pictograma aplicatiei.
' Se livreaza in radacina pachetului Startica, langa Porneste_Startica.vbs.
'
' Un fisier .lnk retine cai absolute, deci nu poate fi livrat gata facut:
' se genereaza aici, pe calculatorul si in folderul unde ramane aplicatia.
' Daca folderul Startica este mutat, ruleaza din nou acest fisier.
Option Explicit

Dim shell, fso, folder, link

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)

' Deschis direct din arhiva ZIP, Windows copiaza doar acest fisier intr-un
' folder temporar, fara restul aplicatiei.
If Not fso.FileExists(folder & "\Aplicatie\runtime\node.exe") Then
    MsgBox "Extrage mai intai intregul folder Startica din arhiva ZIP, " & _
        "apoi ruleaza din nou acest fisier din folderul extras.", _
        vbExclamation, "Startica"
    WScript.Quit 1
End If

Set link = shell.CreateShortcut(shell.SpecialFolders("Desktop") & "\Startica.lnk")
link.TargetPath = shell.ExpandEnvironmentStrings("%SystemRoot%\System32\wscript.exe")
link.Arguments = """" & folder & "\Porneste_Startica.vbs"""
link.WorkingDirectory = folder
link.IconLocation = folder & "\Aplicatie\web\assets\startica.ico,0"
link.Description = "Startica"
link.Save

MsgBox "Scurtatura Startica a fost creata pe Desktop.", vbInformation, "Startica"
