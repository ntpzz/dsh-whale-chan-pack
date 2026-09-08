' Stop: kill whatever DeepSeek Harness (dsh web) is listening on 127.0.0.1:3080.
' Use when you run the persistent whale launcher (DeepSeek Harness.exe) and want to quit it.
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command ""$l = netstat -ano -p tcp | Select-String ':3080\s.*LISTENING'; if ($l) { $p = ($l[0].Line -split '\s+')[-1]; & taskkill /PID $p /T /F }""", 0, False
