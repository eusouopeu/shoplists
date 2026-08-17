import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import './style.css';
import { App } from './ui/App';
import { initTheme } from './services/themeService';

initTheme();
registerSW({ immediate: true });

render(<App />, document.getElementById('app')!);
