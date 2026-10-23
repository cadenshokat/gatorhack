import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

export default defineConfig({
  manifest: {
    name: 'WebAble',
    description: 'Fits every website to the person using it.',
    permissions: ['storage', 'tabs', 'activeTab', 'scripting'],
    host_permissions: ['<all_urls>', 'http://127.0.0.1:8787/*'],
  },
  vite: () => ({ plugins: [preact()] }),
});
