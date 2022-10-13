/* eslint no-alert: 0  */

const $ = el => document.querySelector(el);

document.addEventListener('DOMContentLoaded', async () => {
	// Get storage
	const storage = await browser.storage.local.get({
		domain: '',
		token: '',
		autoCopyUrl: false,
	});

	// Set values
	for (const [key, value] of Object.entries(storage)) {
		const el = $(`#${key}`);

		if (el) {
			if (el.type === 'checkbox') {
				el.checked = value;
			} else {
				el.value = value;
			}
		}
	}

	// Validate url
	$('#domain').addEventListener('blur', function() {
		if (!this.value) return;

		try {
			const url = new URL(this.value);
			this.value = url.origin;
		} catch {
			alert('Not a valid domain!');
		}
	});

	// Save settings
	$('#save').addEventListener('click', async () => {
		const domain = $('#domain').value;
		const token = $('#token').value;
		const autoCopyUrl = $('#autoCopyUrl').checked;

		if (!domain) {
			return alert('chibisafe domain is required!');
		}

		try {
			await browser.runtime.sendMessage({
				action: 'saveConfig',
				data: { domain, token, autoCopyUrl },
			});

			if (token) {
				const isValidToken = await browser.runtime.sendMessage({ action: 'validateApiToken' });
				$('#tokenInvalidNotice').classList[isValidToken ? 'remove': 'add']('show');
			}

			const notificationId = await browser.runtime.sendMessage({
				action: 'createNotification',
				data: {
					message: 'Settings Saved!',
				},
			});

			await browser.runtime.sendMessage({ action: 'refreshContextMenu' });

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
