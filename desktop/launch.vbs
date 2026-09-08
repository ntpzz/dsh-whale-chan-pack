' DeepWhale desktop launcher (hidden, no console). Launches launcher.js next to this file.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run """node"" """ & dir & "\launcher.js""", 0, False
