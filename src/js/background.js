import '/libs/browser-polyfill.min.js';

/* Helpers */

const Helpers = {
	get mimetypes() {
		return {
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
			'audio/x-wav': '.wav',
		};
	},

	fileExt(mimetype) {
		return Helpers.mimetypes[mimetype] || `.${Helpers.mimetype.split('/')[1]}`;
	},

	b64toBlob(b64Data, contentType = '', sliceSize = 512) {
		const byteCharacters = atob(b64Data);
		const byteArrays = [];

		for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
			const slice = byteCharacters.slice(offset, offset + sliceSize);
			const byteNumbers = Array.from({ length: slice.length });

			for (let i = 0; i < slice.length; i++) {
				byteNumbers[i] = slice.codePointAt(i);
			}

			const byteArray = new Uint8Array(byteNumbers);

			byteArrays.push(byteArray);
		}

		const blob = new Blob(byteArrays, { type: contentType });

		return blob;
	},

	versionCompare(a, b) {
		const pa = a.split('.');
		const pb = b.split('.');
		for (let i = 0; i < 3; i++) {
			const na = Number(pa[i]);
			const nb = Number(pb[i]);
			if (na > nb) return true;
			if (nb > na) return false;
			if (!Number.isNaN(na) && Number.isNaN(nb)) return true;
			if (Number.isNaN(na) && !Number.isNaN(nb)) return false;
		}

		return true;
	},

	async loadContentScript(tab) {
		try {
			await browser.tabs.sendMessage(tab.id, { action: 'checkIfLoaded' });
			console.log('Content script was already loaded in tab:', tab.id);
		} catch {
			console.log('Loading content script is loaded in tab:', tab.id);
			await browser.scripting.insertCSS({
				files: ['/css/content.css'],
				target: { tabId: tab.id },
			});
			await browser.scripting.executeScript({
				files: ['/libs/browser-polyfill.min.js', '/js/content.js'],
				target: { tabId: tab.id },
			});
		}
	},

	// todo: need this figure out how to get this to work on MV3
	async copyToClipboard(link, tab) {
		await Helpers.loadContentScript(tab);
		await browser.tabs.sendMessage(tab.id, { action: 'copyToClipboard', data: link });
	},

	get isFirefox() {
		return typeof InstallTrigger !== 'undefined';
	},
};

/* Notifications */

/*
 * This Map stores any active Notifications.
 * If the notification has buttons, their callbacks
 * will be stored as well so they can be called on
 * button click. This service worker will probably
 * be alive long enough for the on click event.
 */
const ActiveNotifications = new Map();

class Notification {
	constructor(options) {
		this.options = {
			type: 'basic',
			title: 'chibisafe',
			silent: true,
			iconUrl: '/images/logo-128x128.png',
		};

		this.buttonCallbacks = [];

		this.#updateOptions(options);

		this.id = crypto.randomUUID();

		browser.notifications.create(this.id, this.options);
		ActiveNotifications.set(this.id, this);
	}

	async update(options) {
		this.#updateOptions(options);
		browser.notifications.clear(this.id);
		await browser.notifications.create(this.id, this.options);
		ActiveNotifications.set(this.id, this);
	}

	clear(timeout = 0) {
		setTimeout(() => {
			browser.notifications.clear(this.id);
			ActiveNotifications.delete(this.id);
		}, timeout);
	}

	#updateOptions(options) {
		this.options = { ...this.options, ...options };

		// Firefox does not support "requireInteraction" or "silent"
		if (Helpers.isFirefox) {
			delete this.options.requireInteraction;
			delete this.options.silent;
		}

		// Firefox does not support "contentMessage"
		if (Helpers.isFirefox && this.options.contextMessage) {
			this.options.message += `\n${this.options.contextMessage}`;
			delete this.options.contextMessage;
		}

		// Firefox does not support "buttons"
		if (Helpers.isFirefox) {
			delete this.options.buttons;
		} else if (Array.isArray(this.options.buttons)) {
			this.buttonCallbacks = this.options.buttons.map(b => b.callback);
			this.options.buttons = this.options.buttons.map(b => ({ title: b.title }));
		}
	}
}

browser.notifications.onButtonClicked.addListener((id, index) => {
	const { buttonCallbacks = [] } = ActiveNotifications.get(id);

	if (typeof buttonCallbacks[index] === 'function') {
		buttonCallbacks[index]();
	}

	browser.notifications.clear(id);
	ActiveNotifications.delete(id);
});

browser.notifications.onClosed.addListener(id => {
	ActiveNotifications.delete(id);
});

/* Referer Header for anti hotlink bypassing on certain image hosts */

let refererHeader = null;

/*
 * This is here only because firefox does not yet support
 * MV3 (declarativeNetRequest) and I need a way to modify
 * this request header.
 */
if (browser.webRequest) {
	browser.webRequest.onBeforeSendHeaders.addListener(details => {
		if (
			details.tabId === -1 &&
			details.method === 'GET' &&
			refererHeader !== null
		) {
			details.requestHeaders.push({
				name: 'Referer',
				value: refererHeader,
			});
		}

		return { requestHeaders: details.requestHeaders };
	}, { urls: ['<all_urls>'] }, ['blocking', 'requestHeaders']);
}

/* Storage Cache */

/*
 * Caching extension storage as to not call the browser.storage api
 * multiple times in a short time. Probably don't need to cache this
 * but doing anything to reduce the time it takes to complete requests
 * in the service worker. ¯\_(ツ)_/¯
 */
const Config = {
	_data: null,

	async init() {
		this._data = await browser.storage.local.get({
			domain: '',
			panelURL: '/dashboard',
			token: '',
			lastAlbum: null,
			autoCopyUrl: false,
		});
	},

	async set(key, value) {
		if (!this._data) {
			await this.init();
		}

		await browser.storage.local.set(key, value);
		this._data[key] = value;
	},

	async get(key) {
		if (!this._data) {
			await this.init();
		}

		return this._data[key];
	},

	async getAll() {
		if (!this._data) {
			await this.init();
		}

		return this._data;
	},
};

/* Chibisafe Uploader */

const Chibisafe = {
	apiVersion: null,

	async fetch(path, options = {}) {
		const config = await Config.getAll();

		const request = new Request(new URL(path, config.domain), options);

		request.headers.set('Accept', 'application/vnd.chibisafe.json, application/vnd.lolisafe.json');

		if (config.token) {
			request.headers.append('token', config.token);
		}

		return fetch(request);
	},

	async getApiVersion() {
		// We should not request this everytime we need it.
		if (this.apiVersion) {
			return this.apiVersion;
		}

		try {
			const data = await this.fetch('/api/version').then(res => res.json());
			this.apiVersion = data.version;
		} catch {
			this.apiVersion = '1.0.0';
		}

		return this.apiVersion;
	},

	async getAlbums() {
		const config = await Config.getAll();
		const apiVersion = await this.getApiVersion();

		if (!config.domain && !config.token) {
			return [];
		}

		try {
			const albumsEndpoint = Helpers.versionCompare(apiVersion, '4.0.0')
				? '/api/albums/dropdown'
				: '/api/albums';

			const data = await this.fetch(albumsEndpoint).then(res => res.json());
			return data.albums;
		} catch (error) {
			console.error('Failed to fetch Albums:', error);
			return [];
		}
	},

	async createContextMenus() {
		const contexts = ['image', 'video', 'audio'];
		const config = await Config.getAll();

		// Remove any context menu if it exist so we can recreate it.
		await browser.contextMenus.removeAll();
		console.log('Removed old Context Menus');

		if (!config.domain) return;

		// Parent Context Menu
		browser.contextMenus.create({
			id: 'topContextMenu',
			title: 'chibisafe',
			contexts: ['all'],
		});

		// Upload
		browser.contextMenus.create({
			id: 'uploadFile',
			title: 'Send to safe',
			parentId: 'topContextMenu',
			contexts,
		});

		// Screenshot Page
		browser.contextMenus.create({
			id: 'uploadScreenshot',
			title: 'Screenshot page',
			parentId: 'topContextMenu',
			contexts: ['page'],
		});

		// Screenshot Selection
		browser.contextMenus.create({
			id: 'uploadScreenshotSelection',
			title: 'Screenshot selection',
			parentId: 'topContextMenu',
			contexts: ['page'],
		});

		if (config.token) {
			const albums = await this.getAlbums();

			/* Separator */
			browser.contextMenus.create({
				id: 'separator1',
				parentId: 'topContextMenu',
				contexts,
				type: 'separator',
			});

			browser.contextMenus.create({
				id: 'refreshAlbumList',
				title: 'Refresh Albums List',
				parentId: 'topContextMenu',
				contexts,
			});

			/* Separator */
			browser.contextMenus.create({
				id: 'separator2',
				parentId: 'topContextMenu',
				contexts,
				type: 'separator',
			});

			if (!albums.length) {
				return browser.contextMenus.create({
					id: 'albumsNotAvailable',
					title: 'No Albums Available',
					parentId: 'topContextMenu',
					contexts,
					type: 'normal',
					enabled: false,
				});
			}

			const lastAlbum = albums.find(a => a.id === config.lastAlbum);

			browser.contextMenus.create({
				id: 'lastAlbum',
				title: `Upload to: ${lastAlbum ? lastAlbum.name : 'None'}`,
				parentId: 'topContextMenu',
				contexts,
				enabled: Boolean(lastAlbum),
			});

			/* Separator */
			browser.contextMenus.create({
				id: 'separator3',
				parentId: 'topContextMenu',
				contexts,
				type: 'separator',
			});

			browser.contextMenus.create({
				id: 'uploadToLabel',
				title: 'Upload to:',
				parentId: 'topContextMenu',
				contexts,
				type: 'normal',
				enabled: false,
			});

			for (const album of albums) {
				browser.contextMenus.create({
					id: `albumId-${album.id}`,
					title: album.name.replaceAll('&', '&&'),
					parentId: 'topContextMenu',
					contexts,
				});
			}
		}
	},

	async uploadFile(url, pageURL, tab, albumId, albumName) {
		const config = await Config.getAll();
		const apiVersion = await this.getApiVersion();

		const notification = new Notification({
			message: 'Uploading...',
			requireInteraction: true,
		});

		if (albumId) {
			await browser.storage.local.set({ lastAlbum: albumId });
			browser.contextMenus.update('lastAlbum', {
				title: `Upload to: ${albumName.replaceAll('&', '&&') }`,
				enabled: true,
			});
		}

		const ruleId = Math.floor(Math.random() * 5000);

		if (browser.declarativeNetRequest) {
			await browser.declarativeNetRequest.updateSessionRules({
				addRules: [{
					id: ruleId,
					priority: 1,
					action: {
						type: "modifyHeaders",
						requestHeaders: [{
							header: 'Referer',
							operation: 'set',
							value: pageURL,
						}],
					},
					condition: {
						urlFilter: url,
					},
				}],
			});
		} else {
			refererHeader = pageURL;
		}

		try {
			const image = await fetch(url).then(res => res.blob());

			refererHeader = null;

			const formData = new FormData();
			formData.append('files[]', image, `upload${Helpers.fileExt(image.type)}`);

			const options = {
				method: 'POST',
				body: formData,
				headers: {},
			};

			if (albumId && config.token) {
				if (Helpers.versionCompare(apiVersion, '4.0.0')) {
					options.headers.albumid = albumId;
				} else {
					options.url = `${options.url}/${albumId}`;
				}
			}

			const data = await this.fetch('/api/upload', options).then(res => res.json());

			const file = Helpers.versionCompare(apiVersion, '4.0.0') ? data : data.files[0];

			if (file) {
				const buttons = [{
					title: 'Delete Upload',
					callback: () => this.deleteFile(file),
				}];

				if (!config.autoCopyUrl) {
					buttons.unshift({
						title: 'Copy to Clipboard',
						callback: () => Helpers.copyToClipboard(file.url, tab),
					});
				}

				notification.update({
					message: 'Upload Complete!',
					contextMessage: file.url,
					buttons,
				});

				if (config.autoCopyUrl) {
					Helpers.copyToClipboard(file.url, tab);
				}

				notification.clear(5e3);
			} else {
				/* This should only ever fire on instances lower than 4.0 */
				notification.update({
					message: data.description || data.message,
					contextMessage: url,
				});
			}
		} catch (error) {
			console.error(error);

			notification.update({
				message: error.toString(),
			});
		} finally {
			if (browser.declarativeNetRequest) {
				await browser.declarativeNetRequest.updateSessionRules({
					removeRuleIds: [ruleId],
				});
			}
		}
	},

	async uploadScreenshot(blob, tab) {
		const config = await Config.getAll();
		const apiVersion = await this.getApiVersion();

		const notification = new Notification({
			message: 'Uploading...',
			requireInteraction: true,
		});

		const formData = new FormData();
		formData.append('files[]', blob, 'upload.png');

		try {
			const data = await this.fetch('/api/upload', {
				method: 'POST',
				body: formData,
			}).then(res => res.json());

			const file = Helpers.versionCompare(apiVersion, '4.0.0') ? data : data.files[0];

			if (file) {
				const buttons = [{
					title: 'Delete Upload',
					callback: () => this.deleteFile(file),
				}];

				if (!config.autoCopyUrl) {
					buttons.unshift({
						title: 'Copy to Clipboard',
						callback: () => Helpers.copyToClipboard(file.url, tab),
					});
				}

				notification.update({
					message: 'Upload Complete!',
					contextMessage: file.url,
					buttons,
				});

				if (config.autoCopyUrl) {
					Helpers.copyToClipboard(file.url, tab);
				}

				notification.clear(5e3);
			} else {
				/* This should only ever fire on instances lower than 4.0 */
				notification.update({
					message: data.description || data.message,
				});
			}
		} catch (error) {
			console.error(error);

			notification.update({
				message: error.toString(),
			});
		}
	},

	async deleteFile(file) {
		const apiVersion = await this.getApiVersion();

		try {
			if (Helpers.versionCompare(apiVersion, '4.0.0')) {
				await this.fetch(file.deleteUrl, {
					method: 'DELETE',
				});

				const notification = new Notification({
					message: `File ${file.name} was deleted!`,
				});

				notification.clear(5e3);
			} else {
				const { files } = await this.fetch('/api/uploads/0').then(res => res.json());
				const fileToDelete = files.find(a => a.name === file.name);

				const { success } = await this.fetch('/api/uploads/delete', {
					method: 'POST',
					body: {
						id: fileToDelete.id,
					},
				});

				const notification = new Notification({
					message: success
						? `File ${file.name} was deleted!`
						: 'Error: Unable to delete the file.',
				});

				notification.clear(5e3);
			}
		} catch (error) {
			console.error(error);

			new Notification({
				message: 'Error: Unable to delete the file.',
			});
		}
	},
};

browser.runtime.onInstalled.addListener(() => {
	Chibisafe.createContextMenus();
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
	const config = await Config.getAll();

	switch (info.menuItemId) {
		case 'topContextMenu': {
			browser.tabs.create({ url: config.domain + config.panelURL });
			break;
		}

		case 'uploadFile': {
			Chibisafe.uploadFile(info.srcUrl, info.pageUrl, tab);
			break;
		}

		case 'uploadScreenshot': {
			const screenshot = await browser.tabs.captureVisibleTab({ format: 'png' });
			const blob = Helpers.b64toBlob(screenshot.replace('data:image/png;base64,', ''), 'image/png');
			Chibisafe.uploadScreenshot(blob, tab);
			break;
		}

		case 'uploadScreenshotSelection': {
			await Helpers.loadContentScript(tab);
			browser.tabs.sendMessage(tab.id, { action: 'startScreenshotSelection' });
			break;
		}

		case 'refreshAlbumList': {
			Chibisafe.createContextMenus();
			break;
		}

		case 'lastAlbum': {
			const albums = await Chibisafe.getAlbums();
			const lastAlbum = albums.find(a => a.id === config.lastAlbum);
			Chibisafe.uploadFile(info.srcUrl, info.pageUrl, tab, lastAlbum.id, lastAlbum.name);
			break;
		}

		default: {
			if (info.menuItemId.startsWith('albumId-')) {
				const albums = await Chibisafe.getAlbums();
				const match = info.menuItemId.match(/albumId-(?<albumId>\d+)/);
				const album = albums.find(a => a.id === Number.parseInt(match.groups.albumId, 10));
				Chibisafe.uploadFile(info.srcUrl, info.pageUrl, tab, album.id, album.name);
			}
		}
	}
});

browser.runtime.onMessage.addListener(async (request, sender) => {
	const { action, data } = request;

	switch(action) {
		case 'screenshotCoordinates': {
			const screenshot = await browser.tabs.captureVisibleTab({ format: 'png' });
			const screenshotBlob = Helpers.b64toBlob(screenshot.replace('data:image/png;base64,', ''), 'image/png');
			const screenshotImage = await createImageBitmap(screenshotBlob);

			const resHeight = Math.abs(data.start.y - data.end.y);
			const resWidth = Math.abs(data.start.x - data.end.x);

			if (resHeight === 0 || resWidth === 0) return;

			const canvas = new OffscreenCanvas(resWidth, resHeight);
			const ctx = canvas.getContext('2d');

			const posX = data.start.x < data.end.x
				? data.start.x
				: data.end.x;
			const posY = data.start.y < data.end.y
				? data.start.y
				: data.end.y;

			ctx.drawImage(screenshotImage, -posX, -posY);

			const croppedImage = await canvas.convertToBlob();

			Chibisafe.uploadScreenshot(croppedImage, sender.tab);

			break;
		}

		case 'refreshConfig': {
			Config.init();
			break;
		}

		case 'refreshAlbumList': {
			Chibisafe.createContextMenus();
			break;
		}

		case 'createNotification': {
			const notification = new Notification(data);
			return notification.id;
		}

		case 'clearNotification': {
			const notification = ActiveNotifications.get(data.notificationId);
			console.log(notification);
			notification.clear(data.timeout);
			break;
		}

		default: {
			break;
		}
	}
});
