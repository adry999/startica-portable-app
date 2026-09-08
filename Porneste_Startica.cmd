@echo off
rem Varianta de rezerva si pentru diagnostic. Pentru pornirea obisnuita
rem foloseste scurtatura Startica sau Porneste_Startica.vbs: acelea nu deschid
rem nicio fereastra de consola, nici macar pentru o clipa.
start "" wscript.exe "%~dp0Porneste_Startica.vbs" %*
exit /b
