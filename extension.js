const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// ─── Sound Player ─────────────────────────────────────────────────────────────

function playSound(soundFile, volume) {
  try {
    const platform = process.platform;
    const vol = Math.max(0, Math.min(100, volume ?? 80));
    const ext = path.extname(soundFile).toLowerCase();

    if (platform === 'darwin') {
      // afplay is built-in on ALL macOS versions (10.5+)
      // -v flag: 0.0 (silent) to 1.0 (full) — supported on all modern macOS
      const v = (vol / 100).toFixed(2);

      // Escape spaces/special chars in path for shell safety
      const safePath = soundFile.replace(/'/g, "'\\''");

      exec(`afplay -v ${v} '${safePath}'`, (err) => {
        if (err) {
          // afplay failed — fallback to open (works on ALL macOS versions)
          exec(`open '${safePath}'`);
        }
      });

    } else if (platform === 'win32') {
      // System.Media.SoundPlayer supports WAV only; use WMPlayer fallback for MP3.
      const safePath = soundFile.replace(/\\/g, '\\\\').replace(/'/g, "''");

      if (ext === '.wav') {
        exec(
          `powershell -c "$p = New-Object System.Media.SoundPlayer '${safePath}'; $p.PlaySync()"`,
          (err) => {
            if (err) {
              // Fallback: Windows Media Player via PowerShell
              exec(`powershell -c "(New-Object -ComObject WMPlayer.OCX).openPlayer('${safePath}')"`);
            }
          }
        );
      } else {
        exec(`powershell -c "(New-Object -ComObject WMPlayer.OCX).openPlayer('${safePath}')"`);
      }

    } else {
      // Linux — try multiple audio players in order of availability
      const pv = Math.round((vol / 100) * 65536);  // paplay:  0–65536
      const fv = vol;                                // ffplay:  0–100
      const cv = (vol / 100).toFixed(2);            // cvlc:    0.0–1.0
      const isMp3 = ext === '.mp3';

      const linuxCommand = isMp3
        ? `if command -v ffplay >/dev/null 2>&1; then
             ffplay -nodisp -autoexit -volume ${fv} "${soundFile}" >/dev/null 2>&1
           elif command -v mpg123 >/dev/null 2>&1; then
             mpg123 -q "${soundFile}"
           elif command -v cvlc >/dev/null 2>&1; then
             cvlc --play-and-exit --gain ${cv} "${soundFile}" >/dev/null 2>&1
           elif command -v paplay >/dev/null 2>&1; then
             paplay --volume=${pv} "${soundFile}"
           elif command -v aplay >/dev/null 2>&1; then
             aplay "${soundFile}"
           else
             echo "Faah Sound: no audio player found" >&2
           fi`
        : `if command -v paplay >/dev/null 2>&1; then
             paplay --volume=${pv} "${soundFile}"
           elif command -v aplay >/dev/null 2>&1; then
             aplay "${soundFile}"
           elif command -v ffplay >/dev/null 2>&1; then
             ffplay -nodisp -autoexit -volume ${fv} "${soundFile}" >/dev/null 2>&1
           elif command -v mpg123 >/dev/null 2>&1; then
             mpg123 -q "${soundFile}"
           elif command -v cvlc >/dev/null 2>&1; then
             cvlc --play-and-exit --gain ${cv} "${soundFile}" >/dev/null 2>&1
           else
             echo "Faah Sound: no audio player found" >&2
           fi`;

      exec(linuxCommand);
    }
  } catch (err) {
    console.error('Faah Sound: error playing sound:', err);
  }
}

// ─── Path Helpers ─────────────────────────────────────────────────────────────

function getDefaultSoundPath(type) {
  const mp3File = type === 'failure' ? 'fahhh.mp3' : 'jaihoo.mp3';
  const wavFile = type === 'failure' ? 'fahhh.wav' : 'jaihoo.wav';
  const mp3Path = path.join(__dirname, 'sounds', mp3File);

  // Prefer MP3 defaults, but keep WAV fallback for backwards compatibility.
  return fs.existsSync(mp3Path) ? mp3Path : path.join(__dirname, 'sounds', wavFile);
}

function getSoundPath(type) {
  const config = vscode.workspace.getConfiguration('faahSound');
  const customKey = type === 'failure' ? 'customFaahSound' : 'customJaiHooSound';
  const custom = config.get(customKey, '');
  return (custom && custom.trim() !== '') ? custom.trim() : getDefaultSoundPath(type);
}

// ─── Config Helpers ───────────────────────────────────────────────────────────

function isEnabled()       { return vscode.workspace.getConfiguration('faahSound').get('enabled', true); }
function isFaahEnabled()   { return vscode.workspace.getConfiguration('faahSound').get('enableFaah', true); }
function isJaiHooEnabled() { return vscode.workspace.getConfiguration('faahSound').get('enableJaiHoo', true); }
function getVolume()       { return vscode.workspace.getConfiguration('faahSound').get('volume', 80); }

// ─── Activate ─────────────────────────────────────────────────────────────────

function activate(context) {

  // Listen for task completions — works immediately after install
  context.subscriptions.push(
    vscode.tasks.onDidEndTaskProcess(e => {
      if (!isEnabled()) return;
      if (e.exitCode === 0) {
        if (isJaiHooEnabled()) playSound(getSoundPath('success'), getVolume());
      } else {
        if (isFaahEnabled()) playSound(getSoundPath('failure'), getVolume());
      }
    })
  );

  // ─── Commands ──────────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('faahSound.testFaah', () => {
      playSound(getSoundPath('failure'), getVolume());
      vscode.window.showInformationMessage('🔊 Playing Faah! sound...');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('faahSound.testJaiHoo', () => {
      playSound(getSoundPath('success'), getVolume());
      vscode.window.showInformationMessage('🎉 Playing Jai Hoo! sound...');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('faahSound.enable', () => {
      vscode.workspace.getConfiguration('faahSound').update('enabled', true, true);
      vscode.window.showInformationMessage('✅ Faah Sound enabled!');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('faahSound.disable', () => {
      vscode.workspace.getConfiguration('faahSound').update('enabled', false, true);
      vscode.window.showInformationMessage('🔇 Faah Sound disabled.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('faahSound.setVolume', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter volume (0-100)',
        value: String(getVolume()),
        validateInput: v => {
          const n = Number(v);
          return (isNaN(n) || n < 0 || n > 100) ? 'Enter a number between 0 and 100' : null;
        }
      });
      if (input !== undefined) {
        vscode.workspace.getConfiguration('faahSound').update('volume', Number(input), true);
        vscode.window.showInformationMessage(`🔊 Volume set to ${input}`);
      }
    })
  );

  // Confirm extension is active
  vscode.window.setStatusBarMessage('🎵 Faah & Jai Hoo active', 3000);
}

function deactivate() {}

module.exports = { activate, deactivate };
