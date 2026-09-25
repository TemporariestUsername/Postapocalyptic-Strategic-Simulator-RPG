import { render } from 'preact';
import './styles/global.css';
import './styles/screens.css';
import { img } from './engine/assets';
import { App } from './ui/App';

// Texture variables used by the CSS UI kit.
const root = document.documentElement.style;
root.setProperty('--metal-url', `url(${img('ui/metal')})`);
root.setProperty('--paper-url', `url(${img('ui/paper')})`);
root.setProperty('--leather-url', `url(${img('ui/leather')})`);
root.setProperty('--concrete-url', `url(${img('ui/concrete')})`);

// Procedural film grain.
const g = document.createElement('canvas');
g.width = g.height = 256;
const gx = g.getContext('2d')!;
const id = gx.createImageData(256, 256);
for (let i = 0; i < id.data.length; i += 4) {
  const v = Math.random() * 255;
  id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
  id.data[i + 3] = 255;
}
gx.putImageData(id, 0, 0);
root.setProperty('--grain-url', `url(${g.toDataURL()})`);

render(<App />, document.getElementById('app')!);
