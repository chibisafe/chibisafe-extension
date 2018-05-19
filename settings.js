const storage = chrome.storage.local;
const background = chrome.extension.getBackgroundPage();

document.addEventListener('DOMContentLoaded', () => {
	storage.get({ domain: '', token: '', autoCopyUrl: false }, (items) => {
		for (key in items) {
			let el = document.getElementById(key);
			if (el) {
				if (el.type === 'checkbox')
					el.checked = items[key];
				else
					el.value = items[key];
			}
		}
	});
});

document.getElementById('save').addEventListener('click', () => {

	const textDomain = document.getElementById('domain').value;
	const textToken = document.getElementById('token').value;
	const autoCopyUrl = document.getElementById('autoCopyUrl').checked;

	if (!textDomain)
		return alert('lolisafe domain is required!');

	storage.set({
		domain: textDomain,
		token: textToken,
		autoCopyUrl: autoCopyUrl
	}, () => {
		background.createContextMenus();
		let notification = background.createNotification('basic', 'Settings Saved!');
		setTimeout(() => chrome.notifications.clear(notification), 5000);
	});

});

document.getElementById('domain').addEventListener('blur', function() {
	if (this.value.slice(-1) === '/')
		this.value = this.value.slice(0, -1);
});