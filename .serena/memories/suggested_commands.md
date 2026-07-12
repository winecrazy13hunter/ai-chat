# Suggested Commands

No project commands defined yet (greenfield). Update when build/dev/test scripts are established.

## Windows-specific notes

- Shell: PowerShell (default in Claude Code on this machine)
- Use `Get-ChildItem` instead of `ls` for directory listing, or rely on Glob/Grep tools
- Path separator: `\` (backslash); PowerShell also accepts `/` in most contexts
- No `&&` operator in PowerShell 5.1 — chain with `;` or `if ($?) { ... }`
