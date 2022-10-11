/* eslint no-alert: 0  */

document.addEventListener('DOMContentLoaded', async () => {
	// Get storage
	const storage = await browser.storage.local.get({
		domain: '',
		token: '',
		autoCopyUrl: false,
	});

	// Set values
	for (const [key, value] of Object.entries(storage)) {
		const el = document.querySelector(`#${key}`);

		if (el) {
			if (el.type === 'checkbox') {
				el.checked = value;
			} else {
				el.value = value;
			}
		}
	}

	// Validate url
	document.querySelector('#domain').addEventListener('blur', function() {
		if (!this.value) return;

		try {
			const url = new URL(this.value);
			this.value = url.origin;
		} catch {
			alert('Not a valid domain!');
		}
	});

	// Save settings
	document.querySelector('#save').addEventListener('click', async () => {
		const domain = document.querySelector('#domain').value;
		const token = document.querySelector('#token').value;
		const autoCopyUrl = document.querySelector('#autoCopyUrl').checked;

		if (!domain) {
			return alert('chibisafe domain is required!');
		}

		try {
			await browser.storage.local.set({ domain, token, autoCopyUrl });

			/*
			 * Refresh the storage cache in the service worker. If the service
			 * worker is inactive then this is pointless. However, this is
			 * needed just in case the service worker is active and has already
			 * cached the extension storage.
			 */
			await browser.runtime.sendMessage({ action: 'refreshConfig' });

			if (token) {
				browser.runtime.sendMessage({ action: 'refreshAlbumList' });
			}

			const notificationId = await browser.runtime.sendMessage({
				action: 'createNotification',
				data: {
					message: 'Settings Saved!',
				},
			});

			browser.runtime.sendMessage({
				action: 'clearNotification',
				data: {
					notificationId,
					timeout: 3e3,
				},
			});
		} catch (error) {
			console.log(error);
		}
	});
});
