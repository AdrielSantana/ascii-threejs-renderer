import type { App } from './registry';
import { createIcon } from '../icons';

export const notepadApp: App = {
  id: 'notepad',
  title: 'Notepad',
  label: 'Notepad',
  icon: createIcon('notepad'),
  defaultRect: { x: 40, y: 40, w: 320, h: 240 },
  minSize: { w: 200, h: 120 },
  mount(body) {
    body.className = 'win98-body';

    const toolbar = document.createElement('div');
    toolbar.className = 'app-toolbar';

    const newBtn = document.createElement('button');
    newBtn.className = 'app-button';
    newBtn.textContent = 'New';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'app-button';
    saveBtn.textContent = 'Save';

    toolbar.appendChild(newBtn);
    toolbar.appendChild(saveBtn);

    const textarea = document.createElement('textarea');
    textarea.className = 'notepad-textarea';
    textarea.value = localStorage.getItem('os:notepad') ?? '';
    textarea.spellcheck = false;

    const status = document.createElement('div');
    status.className = 'win98-statusbar';
    status.innerHTML = '<span>Untitled</span><span>ASCII</span>';

    newBtn.addEventListener('click', () => {
      textarea.value = '';
      localStorage.removeItem('os:notepad');
      status.innerHTML = '<span>Untitled</span><span>ASCII</span>';
    });

    saveBtn.addEventListener('click', () => {
      localStorage.setItem('os:notepad', textarea.value);
      status.innerHTML = '<span>Saved</span><span>ASCII</span>';
      setTimeout(() => {
        status.innerHTML = '<span>Untitled</span><span>ASCII</span>';
      }, 1200);
    });

    body.appendChild(toolbar);
    body.appendChild(textarea);
    body.appendChild(status);
  },
  unmount(body) {
    body.innerHTML = '';
  },
};
