// PreToolUse hook (Bash): before Claude pushes to main/master, run the backend checks.
// Exit code 2 blocks the push and shows stderr to Claude.
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const command = input.tool_input?.command ?? '';
const push = command.match(/\bgit\b[^\n|;&]*\bpush\b[^\n|;&]*/)?.[0];
if (!push) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const protectedBranch = /\b(main|master)\b/;
let currentBranch = '';
try {
  currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, encoding: 'utf8' }).trim();
} catch {
  // Not a git checkout: fall back to the command text only.
}
if (!protectedBranch.test(push) && !protectedBranch.test(currentBranch)) process.exit(0);

const backend = join(root, 'backend');
for (const script of ['lint', 'typecheck', 'test']) {
  const result = spawnSync(`npm run ${script}`, { cwd: backend, shell: true, encoding: 'utf8' });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.split('\n').slice(-40).join('\n');
    process.stderr.write(
      `Push blocked: \`npm run ${script}\` failed in backend/. ` +
        `Fix it (for tests, make sure the DB is up: npm run db:up), then push again.\n\n${output}\n`,
    );
    process.exit(2);
  }
}
