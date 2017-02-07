let storage = chrome.storage.local;
let background = chrome.extension.getBackgroundPage();

document.addEventListener('DOMContentLoaded', function() {
	storage.get(items => {
		for (key in items) {
			document.getElementById(key).value = items[key];
		}
	});
});

document.getElementById('save').addEventListener('click', function() {
	let textDomain = document.getElementById('textDomain').value;
	let textToken = document.getElementById('textToken').value;
	if (!textDomain) {
		alert('loli-safe domain is required!');
		return;
	}
	storage.set({
		"textDomain": textDomain,
		"textToken": textToken || null
	}, function() {
		background.createContextMenus();
		let notification = background.notifications.create('basic', 'Settings Saved!');
		background.notifications.clear(notification, 5000);
	});
});

document.getElementById('textDomain').addEventListener('blur', function() {
	if (this.value.slice(-1) === '/') this.value = this.value.slice(0, -1);
});
