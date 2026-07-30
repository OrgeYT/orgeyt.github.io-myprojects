@echo off
setlocal EnableDelayedExpansion

:: 1. Prompt the user for a message
set /p "target=Enter your message: "

:: 2. Define the characters to cycle through
set "charset= abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.,!?@#+=$"

:: 3. Calculate length
set "len=0"
:strLen
if "!target:~%len%,1!" neq "" (
    set /a len+=1
    goto strLen
)

set "revealed="
echo.
echo Initiating decryption sequence...
echo =================================
echo.

:: 4. Main loop
for /L %%i in (0,1,%len%) do (
    if %%i equ %len% goto :done
    
    set "targetChar=!target:~%%i,1!"
    set "found=0"

    for /L %%j in (0,1,74) do (
        if "!found!"=="0" (
            set "guessChar=!charset:~%%j,1!"
            
            :: Print attempt
            echo !revealed!!guessChar!
            
            :: === Accurate 15 FPS delay (~66ms) ===
            powershell -nop -c "Start-Sleep -Milliseconds 4" >nul 2>&1
            
            if "!guessChar!"=="!targetChar!" (
                set "revealed=!revealed!!targetChar!"
                set "found=1"
            )
        )
    )

    if "!found!"=="0" (
        set "revealed=!revealed!!targetChar!"
    )
)

:done
echo.
echo =======================================
echo Message fully decoded: !revealed!
echo Press Enter to exit.
pause >nul