import type { App } from './registry';
import { createIcon } from '../icons';

const ASCII_SPLASH = `
<span class="pink">  ____  _____ ____  _   _ ___  ____  </span>
<span class="purple"> |  _ \\| ____| __ )| | | / _ \\|  _ \\ </span>
<span class="cyan"> | |_) |  _| |  _ \\| | | | | | | |_) |</span>
<span class="white"> |  _ <| |___| |_) | |_| | |_| |  _ < </span>
<span class="pink"> |_| \\_\\_____|____/ \\___/ \\___/|_| \\_\\</span>

<span class="cyan">  RETROWAVE OS v0.1</span>

  Built with Three.js + ASCII shader
  Mobile-first / Win98 chrome

  [ OK ]</span>
`;

export const aboutApp: App = {
  id: 'about',
  title: 'About',
  label: 'About',
  icon: createIcon('about'),
  defaultRect: { x: 80, y: 80, w: 340, h: 260 },
  minSize: { w: 220, h: 160 },
  mount(body) {
    body.className = 'win98-body';
    const el = document.createElement('div');
    el.className = 'about-body';
    el.innerHTML = ASCII_SPLASH;
    body.appendChild(el);
  },
  unmount(body) {
    body.innerHTML = '';
  },
};
