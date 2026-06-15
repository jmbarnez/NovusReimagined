$p = Start-Process -FilePath npm -ArgumentList 'run','typecheck' -WorkingDirectory 'C:/Users/JBCry/Desktop/Novus' -NoNewWindow -PassThru -RedirectStandardOutput 'C:/Users/JBCry/Desktop/Novus/typecheck2.out' -RedirectStandardError 'C:/Users/JBCry/Desktop/Novus/typecheck2.err'
Wait-Process -Id $p.Id
'EXIT:' + $p.ExitCode
