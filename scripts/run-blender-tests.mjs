import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function resolveBlenderExecutable() {
  if (process.env['BLENDER_PATH']) {
    return process.env['BLENDER_PATH'];
  }

  if (process.platform === 'win32') {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const candidateBase = path.join(programFiles, 'Blender Foundation');
    if (fs.existsSync(candidateBase)) {
      const entries = fs.readdirSync(candidateBase);
      for (const entry of entries) {
        const candidateExe = path.join(candidateBase, entry, 'blender.exe');
        if (fs.existsSync(candidateExe)) {
          return candidateExe;
        }
      }
    }
  } else if (process.platform === 'darwin') {
    const macPath = '/Applications/Blender.app/Contents/MacOS/Blender';
    if (fs.existsSync(macPath)) {
      return macPath;
    }
  }

  return 'blender';
}

const blenderExe = resolveBlenderExecutable();
const testScript = path.join(rootDir, 'addon', 'tests', 'test_blender_real.py');

const child = spawn(blenderExe, ['--background', '--python', testScript], {
  cwd: rootDir,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
