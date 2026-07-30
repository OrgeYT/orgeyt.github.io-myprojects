@echo off
setlocal EnableDelayedExpansion

echo =====================================
echo        Folder to TXT Logger
echo =====================================
echo.

set /p "folderPath=Enter full folder path: "

if not exist "%folderPath%" (
    echo Folder does not exist!
    pause
    exit /b
)

echo.
set /p "includeFiles=Dump file contents too? (Y/N): "

set "includeBinary=N"

if /i "%includeFiles%"=="Y" (
    echo.
    set /p "includeBinary=Dump binary files too (PNG, OGG, MP3, etc)? (Y/N): "
)

set "outputDir=C:\Users\rootb\Documents/folder dumps"

if not exist "%outputDir%" mkdir "%outputDir%"

set "outFile=folder_dump_%random%.txt"
set "tempFile=%cd%\%outFile%"

(
echo Folder contents of: %folderPath%
echo =====================================
tree "%folderPath%" /f /a

if /i "%includeFiles%"=="Y" (
    echo.
    echo =====================================
    echo FILE CONTENTS
    echo =====================================

    for /r "%folderPath%" %%F in (*) do (
        call :dumpFile "%%F"
    )
)

) > "%tempFile%"

move "%tempFile%" "%outputDir%\%outFile%" >nul

echo.
echo Done!
echo Saved to:
echo %outputDir%\%outFile%

pause
exit /b


:dumpFile
set "file=%~1"
set "ext=%~x1"

if /i "!includeBinary!"=="N" (
    if /i "!ext!"==".png" exit /b
    if /i "!ext!"==".jpg" exit /b
    if /i "!ext!"==".jpeg" exit /b
    if /i "!ext!"==".gif" exit /b
    if /i "!ext!"==".webp" exit /b
    if /i "!ext!"==".ogg" exit /b
    if /i "!ext!"==".mp3" exit /b
    if /i "!ext!"==".wav" exit /b
    if /i "!ext!"==".mp4" exit /b
    if /i "!ext!"==".exe" exit /b
    if /i "!ext!"==".dll" exit /b
    if /i "!ext!"==".ttf" exit /b
    if /i "!ext!"==".otf" exit /b
)

echo.
echo -------------------------------------
echo FILE: %file%
echo -------------------------------------

type "%file%" 2>nul

exit /b