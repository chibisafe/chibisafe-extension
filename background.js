const storage = chrome.storage.local;

const isFirefox = typeof InstallTrigger !== 'undefined';

chrome.runtime.onInstalled.addListener((details) => {
	if (details.reason == 'update') {

		storage.get((items) => {

			let newItems = {};

			if (items.textDomain) {
				newItems.domain = items.textDomain;
				storage.remove('textDomain');
			}

			if (items.textToken) {
				newItems.token = items.textToken;
				storage.remove('textToken');
			}

			storage.set(newItems);

		});

	}
});

const contexts = ['image', 'video', 'audio'];

let config = {};

storage.get({
	domain: '',
	panelURL: '/dashboard',
	token: '',
	lastAlbum: null
}, (items) => {
	config = items;
	createContextMenus();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
	for (key in changes) {
		config[key] = changes[key].newValue;
		if (key === 'token') createContextMenus();
	}
});

function createContextMenus() {

	if (!config.domain) return;

	/* == Not the best way to do this but when have I ever done something efficiently? == */
	chrome.contextMenus.removeAll(() => {

		console.log('Removed old Context Menus');

		/* == Parent Context Menu == */
		contextMenus.parent = chrome.contextMenus.create({
			title: 'lolisafe',
			contexts: ['all'],
			onclick: () => chrome.tabs.create({ url: config.domain + config.panelURL })
		});

		/* == Upload normally == */
		chrome.contextMenus.create({
			title: 'Send to safe',
			parentId: contextMenus.parent,
			contexts: contexts,
			onclick: (info) => upload(info.srcUrl, info.pageUrl)
		});

		/* == Screenshot page == */
		chrome.contextMenus.create({
			title: 'Screenshot page',
			parentId: contextMenus.parent,
			contexts: ['page'],
			onclick: (info) => {
				chrome.tabs.captureVisibleTab({ format: 'png' }, (data) => {
					let blob = b64toBlob(data.replace('data:image/png;base64,', ''), 'image/png');
					uploadScreenshot(blob);
				});
			}
		});

		/* == Screenshot selection == */
		chrome.contextMenus.create({
			title: 'Screenshot selection',
			parentId: contextMenus.parent,
			contexts: ['page'],
			onclick: (info) => {
				chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
					chrome.tabs.sendMessage(tabs[0].id, 'check', (response) => {
						if (response) {
							chrome.tabs.sendMessage(tabs[0].id, 'select');
						} else {
							chrome.tabs.insertCSS(null, { file: 'content.css' });
							chrome.tabs.executeScript(null, { file: 'content.js' }, () => {
								chrome.tabs.sendMessage(tabs[0].id, 'select');
							});
						}
					});
				});
			}
		});

		if (config.token) {

			/* == Separator == */
			chrome.contextMenus.create({
				parentId: contextMenus.parent,
				contexts: contexts,
				type: 'separator'
			});

			/* == Refresh Album List == */
			chrome.contextMenus.create({
				title: 'Refresh Albums List',
				parentId: contextMenus.parent,
				contexts: contexts,
				onclick: createContextMenus
			});

			/* == Separator == */
			chrome.contextMenus.create({
				parentId: contextMenus.parent,
				contexts: contexts,
				type: 'separator'
			});

			axios.get(config.domain + '/api/albums', {
				headers: { token: config.token }
			}).then((list) => {

				if (list.data.albums.length === 0) {

					chrome.contextMenus.create({
						title: 'No Albums Available',
						parentId: contextMenus.parent,
						contexts: contexts,
						type: 'normal',
						enabled: false
					});

				} else {

					const lastAlbum = list.data.albums.find(a => a.id === config.lastAlbum);

					contextMenus.lastAlbum = chrome.contextMenus.create({
						title: `Upload to: ${lastAlbum ? lastAlbum.name : 'None'}`,
						parentId: contextMenus.parent,
						contexts: contexts,
						enabled: !!lastAlbum,
						onclick: (info) => upload(info.srcUrl, info.pageUrl, lastAlbum ? lastAlbum.id : -1)
					});

					/* == Separator == */
					chrome.contextMenus.create({
						parentId: contextMenus.parent,
						contexts: contexts,
						type: 'separator'
					});

					contextMenus.albumsParent = chrome.contextMenus.create({
						title: 'Upload to:',
						parentId: contextMenus.parent,
						contexts: contexts,
						type: 'normal',
						enabled: false
					});

					list.data.albums.forEach((album) => {
						console.log(album.id, album.name);
						contextMenus.createAlbumMenu(album.id, album.name);
					});

				}

			}).catch((err) => {

				console.log(err);

				chrome.contextMenus.create({
					title: 'Error Getting Albums',
					parentId: contextMenus.parent,
					contexts: contexts,
					type: 'normal',
					enabled: false
				});

			});

		}

	});

}

let contextMenus = {
	parent: null,
	albumsParent: null,
	lastAlbum: null,
	createAlbumMenu: (id, name, enabled = true) => {
		chrome.contextMenus.create({
			title: name.replace('&', '&&'),
			parentId: contextMenus.parent,
			// parentId: contextMenus.albumsParent,
			contexts, enabled,
			onclick: (info) => upload(info.srcUrl, info.pageUrl, id, name)
		});
	}
};

let refererHeader = null;
let contentURL = '';

/* == We need to set this header for image sources that check it for auth or to prevent hotlinking == */
chrome.webRequest.onBeforeSendHeaders.addListener((details) => {

	if (details.tabId === -1 && details.method === 'GET' && refererHeader !== null) {

		details.requestHeaders.push({
			name: 'Referer',
			value: refererHeader
		});

		details.requestHeaders.push({
			name: 'Referrer',
			value: refererHeader
		});

	}

	return {requestHeaders: details.requestHeaders};

}, {urls: ['<all_urls>']}, ['blocking', 'requestHeaders']);

function upload(url, pageURL, albumID, albumName) {

	if (albumID)
		storage.set({ lastAlbum: albumID }, () => {
			chrome.contextMenus.update(contextMenus.lastAlbum, {
				title: `Upload to: ${albumName}`,
				onclick: (info) => upload(info.srcUrl, info.pageUrl, albumID, albumName)
			});
		});

	let notification = createNotification('basic', 'Retriving file...', null, true);

	refererHeader = pageURL;

	axios.get(url, { responseType: 'blob' }).then((file) => {

		refererHeader = null;

		if (!isFirefox) {
			chrome.notifications.update(notification, {
				type: 'progress',
				message: 'Uploading...',
				progress: 0
			});
		}

		let data = new FormData();
		data.append('files[]', file.data, 'upload' + fileExt(file.data.type));

		let options = {
			method: 'POST',
			url: `${config.domain}/api/upload`,
			data,
			headers: {
				token: config.token
			},
			onUploadProgress: (progress) => {
				if (!isFirefox) {
					chrome.notifications.update(notification, {
						progress: Math.round((progress.loaded * 100) / progress.total)
					});
				}
			}
		};

		if (albumID && config.token)
			options.url = options.url + '/' + albumID;

		axios.request(options).then((response) => {

			if (response.data.success === true || response.data.files) {

				if (!isFirefox) {
					chrome.notifications.update(notification, {
						type: 'basic',
						message: 'Upload Complete!',
						contextMessage: response.data.files[0].url,
						buttons: [{ title: 'Copy to clipboard' }]
					});
				} else {
					createNotification('basic', 'Upload Complete!');
				}

				contentURL = response.data.files[0].url;

				setTimeout(() => chrome.notifications.clear(notification), 5000);

			} else {

				if (!isFirefox) {
					chrome.notifications.update(notification, {
						type: 'basic',
						message: response.data.description || response.data.message,
						contextMessage: url,
					});
				} else {
					createNotification('basic', response.data.description || response.data.message);
				}

			}

		}).catch((err) => {

			console.error(err);

			if (!isFirefox) {
				chrome.notifications.update(notification, {
					type: 'basic',
					message: 'Error!',
					contextMessage: err.toString(),
				});
			} else {
				createNotification('basic', `Error!\n${err.toString()}`);
			}

		});

	});

}

function uploadScreenshot(blob, albumID) {

	let notification = createNotification('progress', 'Uploading...', null, true, 0);

	let data = new FormData();

	data.append('files[]', blob, 'upload.png');

	let options = {
		method: 'POST',
		url: `${config.domain}/api/upload`,
		data,
		headers: {
			token: config.token
		},
		onUploadProgress: (progress) => {
			if (!isFirefox) {
				chrome.notifications.update(notification, {
					progress: Math.round((progress.loaded * 100) / progress.total)
				});
			}
		}
	};

	if (albumID && config.token)
		options.url = options.url + '/' + albumID;

	axios.request(options).then((response) => {

		if (response.data.success === true || response.data.files) {

			if (!isFirefox) {
				chrome.notifications.update(notification, {
					type: 'basic',
					message: 'Upload Complete!',
					contextMessage: response.data.files[0].url,
					buttons: [{ title: 'Copy to clipboard' }]
				});
			} else {
				createNotification('basic', 'Upload Complete!');
			}

			contentURL = response.data.files[0].url;

			setTimeout(() => chrome.notifications.clear(notification), 5000);

		} else {

			if (!isFirefox) {
				chrome.notifications.update(notification, {
					type: 'basic',
					message: response.data.description || response.data.message
				});
			} else {
				createNotification('basic', response.data.description || response.data.message);
			}

		}

	}).catch((err) => {

		console.error(err);

		if (!isFirefox) {
			chrome.notifications.update(notification, {
				type: 'basic',
				message: 'Error!',
				contextMessage: err.toString(),
			});
		} else {
			createNotification('basic', `Error!\n${err.toString()}`);
		}

	});

}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

	if ('coordinates' in request) {

		let pos = request.coordinates;

		chrome.tabs.captureVisibleTab({ format: 'png' }, (data) => {

			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			const img = new Image();

			img.onload = () => {

				let resHeight = Math.abs(pos[0].y - pos[1].y);
				let resWidth = Math.abs(pos[0].x - pos[1].x);

				if (resHeight === 0 || resWidth === 0) return;

				let posX = pos[0].x < pos[1].x
					? pos[0].x
					: pos[1].x;
				let posY = pos[0].y < pos[1].y
					? pos[0].y
					: pos[1].y;

				canvas.height = resHeight;
				canvas.width = resWidth;

				ctx.drawImage(img, -posX, -posY);

				let imageData = canvas.toDataURL();

				let blob = b64toBlob(imageData.replace('data:image/png;base64,', ''), 'image/png');

				uploadScreenshot(blob);

			};

			img.src = data;

		});

	}

});

function createNotification(type, message, altText, sticky, progress) {

	let notificationContent = {
		type,
		title: 'lolisafe',
		message,
		iconUrl: 'logo-128x128.png'
	};

	if (typeof InstallTrigger === 'undefined') // Does not work with firefox.
		notificationContent.requireInteraction = sticky || false;

	if (altText && typeof altText === 'string')
		notificationContent.contextMessage = altText;

	if (progress && typeof progress === 'integer')
		notificationContent.progress = progress;

	let id = 'notification_' + Date.now();

	chrome.notifications.create(id, notificationContent);

	return id;

}

chrome.notifications.onClicked.addListener((id) => chrome.notifications.clear(id));
chrome.notifications.onButtonClicked.addListener(() => copyText(contentURL));
chrome.notifications.onClosed.addListener(() => contentURL = '');

const mimetypes = {
	'image/png': '.png',
	'image/jpeg': '.jpg',
	'image/gif': '.gif',
	'image/bmp': '.bmp',
	'image/x-icon': '.ico',
	'video/mp4': '.mp4',
	'video/webm': '.webm',
	'video/quicktime': '.mov',
	'audio/mp4': '.mp4a',
	'audio/mpeg': '.mp3',
	'audio/ogg': '.ogg',
	'audio/x-aac': '.aac',
	'audio/x-wav': '.wav'
}

function fileExt(mimetype) {
	return mimetypes[mimetype] || '.' + mimetype.split('/')[1];
}

function copyText(text) {
	let input = document.createElement('textarea');
	document.body.appendChild(input);
	input.value = text;
	input.focus();
	input.select();
	document.execCommand('Copy');
	input.remove();
}

// http://stackoverflow.com/a/16245768
function b64toBlob(b64Data, contentType, sliceSize) {

	contentType = contentType || '';
	sliceSize = sliceSize || 512;

	let byteCharacters = atob(b64Data);
	let byteArrays = [];

	for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {

		let slice = byteCharacters.slice(offset, offset + sliceSize);

		let byteNumbers = new Array(slice.length);

		for (let i = 0; i < slice.length; i++) {
			byteNumbers[i] = slice.charCodeAt(i);
		}

		let byteArray = new Uint8Array(byteNumbers);

		byteArrays.push(byteArray);

	}

	let blob = new Blob(byteArrays, { type: contentType });

	return blob;
}