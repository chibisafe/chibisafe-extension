const background = browser.extension.getBackgroundPage();
const $ = el => document.getElementById(el);

document.addEventListener('DOMContentLoaded', async () => {
	// Get storage
	const storage = await browser.storage.local.get({
		domain: '',
		token: '',
		autoCopyUrl: false,
	});

	// Set values
	for (const key in storage) { // eslint-disable-line
		const el = $(key);
		if (el) {
			if (el.type === 'checkbox') {
				el.checked = storage[key];
			} else {
				el.value = storage[key];
			}
		}
	}

	// Validate url
	$('domain').addEventListener('blur', function() {
		if (!this.value) return;

		try {
			const url = new URL(this.value);
			this.value = url.origin;
		} catch (err) {
			return alert('Not a valid domain!'); // eslint-disable-line
		}
	});

	// Save settings
	$('save').addEventListener('click', () => {
		const domain = $('domain').value;
		const token = $('token').value;
		const autoCopyUrl = $('autoCopyUrl').checked;

		if (!domain) {
			return alert('lolisafe domain is required!'); // eslint-disable-line
		}

		browser.storage.local.set({ domain, token, autoCopyUrl }).then(() => {
			background.uploader.init();
			const notification = new background.Notification({ message: 'Settings Saved!' });
			notification.clear(3e3);
		}).catch(console.error);
	});
});
