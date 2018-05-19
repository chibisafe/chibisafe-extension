const storage = chrome.storage.local;
const background = chrome.extension.getBackgroundPage();

document.addEventListener('DOMContentLoaded', () => {
	storage.get({ domain: '', token: '' }, (items) => {
		for (key in items) {
			if (document.getElementById(key))
				document.getElementById(key).value = items[key];
		}
	});
});

document.getElementById('save').addEventListener('click', () => {

	const textDomain = document.getElementById('domain').value;
	const textToken = document.getElementById('token').value;

	if (!textDomain)
		return alert('lolisafe domain is required!');

	storage.set({
		domain: textDomain,
		token: textToken
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