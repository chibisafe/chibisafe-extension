import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
	vite: () => ({
		plugins: [tailwindcss()]
	}),
	debug: true,
	modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
	manifest: () => ({
		name: 'chibisafe-uploader',
		permissions: ['storage', 'contextMenus', 'declarativeNetRequest'],
		host_permissions: ['<all_urls>'],
		options_ui: {
			page: 'options/index.html',
			open_in_tab: true
		},
		web_accessible_resources: [
			{
				resources: ['iframe.html'],
				matches: ['<all_urls>']
			}
		],
		browser_specific_settings: {
			gecko: {
				id: 'chibisafe-uploader@chibisafe.app'
			}
		}
	})
});
