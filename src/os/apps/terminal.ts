import type { App } from './registry';
import { createIcon } from '../icons';

const ASCII_ART = `
<span style="color:#ff2a86">  _______  ______  _____ __   _</span>
<span style="color:#b537f2"> |__   __||  ____||  __ \\\\ \\ | |</span>
<span style="color:#00f0ff">    | |   | |__   | |__) |\\| |</span>
<span style="color:#fff">    | |   |  __|  |  _  / |  |</span>
<span style="color:#ff2a86">    | |   | |____ | | \\ \\ | |</span>
<span style="color:#b537f2">    |_|   |______||_|  \\_\\\\_|</span>
`;

const COMMANDS: Record<string, { desc: string; run: (args: string[]) => string }> = {
  help: {
    desc: 'Show available commands',
    run: () =>
      Object.entries(COMMANDS)
        .map(([cmd, info]) => `  ${cmd.padEnd(10)} ${info.desc}`)
        .join('\n'),
  },
  echo: {
    desc: 'Print text',
    run: (args) => args.join(' ') || '',
  },
  date: {
    desc: 'Show current date',
    run: () => new Date().toLocaleDateString('pt-BR'),
  },
  time: {
    desc: 'Show current time',
    run: () => new Date().toLocaleTimeString('pt-BR'),
  },
  ver: {
    desc: 'Show OS version',
    run: () => 'Retrowave OS v0.1 — Mobile Edition',
  },
  whoami: {
    desc: 'Show current user',
    run: () => 'admin@retrowave',
  },
  dir: {
    desc: 'List files',
    run: () =>
      '  Volume in drive C has no label\n  Directory of C:\\\n\n  01/01/1998  12:00    <DIR>    SYSTEM\n  01/01/1998  12:00    <DIR>    APPS\n  01/01/1998  12:00    <DIR>    GAMES\n  01/01/1998  12:00    <DIR>    DESKTOP\n  01/01/1998  12:00       512  CONFIG.SYS\n  01/01/1998  12:00       256  AUTOEXEC.BAT',
  },
  neofetch: {
    desc: 'Show system info',
    run: () =>
      `${ASCII_ART}\n  OS: Retrowave OS v0.1\n  Host: Mobile ASCII\n  Kernel: Three.js 0.160.1\n  Shell: Win98 Chrome\n  Terminal: VT323\n  Resolution: ${window.innerWidth}x${window.innerHeight}\n  Theme: Retrowave`,
  },
  clear: {
    desc: 'Clear screen',
    run: () => '__CLEAR__',
  },
  cls: {
    desc: 'Clear screen',
    run: () => '__CLEAR__',
  },
  pwd: {
    desc: 'Print working directory',
    run: () => 'C:\\',
  },
  hostname: {
    desc: 'Show hostname',
    run: () => 'retrowave-os',
  },
  uptime: {
    desc: 'Show uptime',
    run: () => {
      const s = Math.floor(performance.now() / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      return `${h}h ${m % 60}m ${s % 60}s`;
    },
  },
};

export const terminalApp: App = {
  id: 'terminal',
  title: 'Terminal',
  label: 'Terminal',
  icon: createIcon('terminal'),
  defaultRect: { x: 50, y: 50, w: 420, h: 340 },
  minSize: { w: 240, h: 160 },
  mount(body) {
    body.className = 'win98-body';

    const output = document.createElement('div');
    output.className = 'terminal-output';
    output.style.cssText = 'flex:1; overflow-y:auto; background:#000; color:#00ff00; font-family:VT323,monospace; font-size:16px; padding:8px; line-height:1.2; white-space:pre-wrap; word-break:break-all;';

    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex; align-items:center; background:#000; border-top:1px solid #333; padding:4px 8px;';

    const prompt = document.createElement('span');
    prompt.style.cssText = 'color:#00ff00; font-family:VT323,monospace; font-size:16px; white-space:pre;';
    prompt.textContent = 'C:\\>';

    const input = document.createElement('input');
    input.type = 'text';
    input.style.cssText = 'flex:1; background:#000; color:#00ff00; border:0; outline:0; font-family:VT323,monospace; font-size:16px; caret-color:#00ff00;';
    input.autocomplete = 'off';
    input.spellcheck = false;

    inputRow.appendChild(prompt);
    inputRow.appendChild(input);

    // Boot message
    const bootLine = document.createElement('div');
    bootLine.innerHTML = `${ASCII_ART}\n\nRetrowave OS Terminal v0.1\nType 'help' for available commands.\n`;
    output.appendChild(bootLine);

    body.appendChild(output);
    body.appendChild(inputRow);

    let history: string[] = [];
    let histIdx = -1;

    const runCommand = (cmdLine: string) => {
      const line = document.createElement('div');
      line.textContent = `C:\\>${cmdLine}`;
      output.appendChild(line);

      const trimmed = cmdLine.trim();
      if (!trimmed) return;

      history.push(trimmed);
      histIdx = history.length;

      const parts = trimmed.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      const command = COMMANDS[cmd];
      if (command) {
        const result = command.run(args);
        if (result === '__CLEAR__') {
          output.innerHTML = '';
          const bootLine2 = document.createElement('div');
          bootLine2.innerHTML = `${ASCII_ART}\n\n`;
          output.appendChild(bootLine2);
        } else {
          const resultLine = document.createElement('div');
          resultLine.innerHTML = result;
          output.appendChild(resultLine);
        }
      } else {
        const err = document.createElement('div');
        err.style.color = '#ff2a86';
        err.textContent = `'${cmd}' is not recognized as an internal or external command.`;
        output.appendChild(err);
      }

      output.scrollTop = output.scrollHeight;
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = input.value;
        input.value = '';
        runCommand(val);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (histIdx > 0) {
          histIdx--;
          input.value = history[histIdx];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (histIdx < history.length - 1) {
          histIdx++;
          input.value = history[histIdx];
        } else {
          histIdx = history.length;
          input.value = '';
        }
      }
    });

    // Focus input on mount
    setTimeout(() => input.focus(), 100);

    // Click on output focuses input
    output.addEventListener('pointerdown', () => input.focus());
  },
  unmount(body) {
    body.innerHTML = '';
  },
};
