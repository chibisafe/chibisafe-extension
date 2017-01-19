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
	let textAdminToken = document.getElementById('textAdminToken').value;
	if (!textDomain) {
		alert('loli-safe domain is required!');
		return;
	}
	storage.set({
		"textDomain": textDomain,
		"textToken": textToken || null,
		"textAdminToken": textAdminToken || null,
	}, function() {
		background.createContextMenus();
		background.createNotification('basic', 'Settings Saved!');
		background.clearNotification();
	});
});

document.getElementById('textDomain').addEventListener('blur', function() {
	if (this.value.slice(-1) === '/') this.value = this.value.slice(0, -1);
});
