// entrypoints/example-ui.content/index.tsx
import ReactDOM from 'react-dom/client';
import 'sonner/dist/styles.css';
import '../../assets/tailwind.css';
import App from './App.tsx';

export default defineContentScript({
	matches: ['<all_urls>'],
	cssInjectionMode: 'ui',

	async main(ctx) {
		const ui = await createShadowRootUi(ctx, {
			name: 'chibisafe-uploader',
			position: 'inline',
			anchor: 'body',
			append: 'first',
			onMount: container => {
				// Container is a body, and React warns when creating a root on the body, so create a wrapper div
				const app = document.createElement('div');
				container.append(app);

				// Create a root on the UI container and render a component
				const root = ReactDOM.createRoot(app);

				root.render(<App />);
				return root;
			},
			onRemove: root => {
				// Unmount the root when the UI is removed
				root?.unmount();
			}
		});

		browser.runtime.onMessage.addListener(message => {
			if (message.type === 'loadUI') {
				ui.mount();
			} else if (message.type === 'unloadUI') {
				ui.remove();
			}
		});
	}
});
