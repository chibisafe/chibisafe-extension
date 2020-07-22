/* global axios */

/* Helpers */

class Helpers {
	static get mimetypes() {
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
	}

	static fileExt(mimetype) {
		return Helpers.mimetypes[mimetype] || `.${Helpers.mimetype.split('/')[1]}`;
	}

	static copyText(text) {
		const input = document.createElement('textarea');
		document.body.appendChild(input);
		input.value = text;
		input.focus();
		input.select();
		document.execCommand('Copy');
		input.remove();
	}

	static b64toBlob(b64Data, contentType, sliceSize) {
		contentType = contentType || '';
		sliceSize = sliceSize || 512;

		const byteCharacters = atob(b64Data);
		const byteArrays = [];

		for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
			const slice = byteCharacters.slice(offset, offset + sliceSize);
			const byteNumbers = new Array(slice.length);

			for (let i = 0; i < slice.length; i++) {
				byteNumbers[i] = slice.charCodeAt(i);
			}

			const byteArray = new Uint8Array(byteNumbers);

			byteArrays.push(byteArray);
		}

		const blob = new Blob(byteArrays, { type: contentType });

		return blob;
	}

	static versionCompare(a, b) {
		const pa = a.split('.');
		const pb = b.split('.');
		for (let i = 0; i < 3; i++) {
			const na = Number(pa[i]);
			const nb = Number(pb[i]);
			if (na > nb) return true;
			if (nb > na) return false;
			if (!isNaN(na) && isNaN(nb)) return true;
			if (isNaN(na) && !isNaN(nb)) return false;
		}
		return true;
	}

	static get isFirefox() {
		return typeof InstallTrigger !== 'undefined';
	}

	static get chromeVersion() {
		return navigator.userAgent.match(/Chrome\/(\d+)/);
	}
}

/* Notifications */

const notifications = new Map();

window.Notification = class Notification { // eslint-disable-line
	constructor(options) {
		this.content = Object.assign({
			type: 'basic',
			title: 'lolisafe',
			silent: true,
			iconUrl: 'images/logo-128x128.png',
		}, options);

		this.callbacks = {};

		this._setup(options);

		browser.notifications.create(this.content).then(id => {
			this.id = id;
			notifications.set(this.id, this);
		});
	}

	update(options) {
		Object.assign(this.content, options);
		this._setup(options);
		browser.notifications.clear(this.id);
		browser.notifications.create(this.id, this.content).then(() => {
			notifications.set(this.id, this);
		});
	}

	clear(timeout = 0) {
		setTimeout(() => browser.notifications.clear(this.id), timeout);
	}

	_setup(options) {
		// Firefox does not support "requireInteraction"
		if (Helpers.isFirefox) {
			delete this.content.requireInteraction;
		}

		// Firefox does not support "contentMessage"
		if (Helpers.isFirefox && options.contextMessage) {
			this.content.message += `\n${options.contextMessage}`;
		}

		// Firefox does not support "buttons"
		if (Helpers.isFirefox) {
			delete this.content.buttons;
		} else if (Array.isArray(options.buttons)) {
			this.content.buttons = options.buttons.map(b => ({ title: b.title }));
			this.callbacks.onButtonClicked = options.buttons.map(b => b.callback);
		}
	}
};

browser.notifications.onButtonClicked.addListener((id, index) => {
	const { callbacks } = notifications.get(id);
	if (typeof callbacks.onButtonClicked[index] === 'function') {
		callbacks.onButtonClicked[index]();
	}
	browser.notifications.clear(id);
});

browser.notifications.onClosed.addListener(id => {
	notifications.delete(id);
});

/* Referer Header */
/* We need to set this header for image sources that check it for auth or to prevent hotlinking */

let refererHeader = null;
const opt_extraInfoSpec = ['blocking', 'requestHeaders'];

if (Helpers.chromeVersion && parseInt(Helpers.chromeVersion[1], 10) >= 72) {
	opt_extraInfoSpec.push('extraHeaders');
}

browser.webRequest.onBeforeSendHeaders.addListener(details => {
	if (details.tabId === -1 && details.method === 'GET' && refererHeader !== null) {
		details.requestHeaders.push({
			name: 'Referer',
			value: refererHeader,
		});
	}

	return { requestHeaders: details.requestHeaders };
}, { urls: ['<all_urls>'] }, opt_extraInfoSpec);

/*  */

class LoliSafeUploader {
	constructor() {
		this.version = '';
		this.contexts = ['image', 'video', 'audio'];
		this.config = {};

		this.contextMenus = {
			parent: null,
			albumsParent: null,
			lastAlbum: null,
		};

		this.init();
	}

	async init() {
		this.config = await browser.storage.local.get({
			domain: '',
			panelURL: '/dashboard',
			token: '',
			lastAlbum: null,
			autoCopyUrl: false,
		});

		this.createAxiosInstance();
		await this.versionCheck();
		this.createContextMenus();
	}

	createAxiosInstance() {
		if (!this.config.domain) return;

		const headers = {
			accept: 'application/vnd.lolisafe.json',
		};

		if (this.config.token) {
			headers.token = this.config.token;
		}

		this.axios = axios.create({
			baseURL: this.config.domain,
			headers,
		});
	}

	async versionCheck() {
		try {
			const res = await this.axios.get('/api/version');
			this.version = res.data.version;
		} catch (error) {
			this.version = '1.0.0';
		}
		return this.version;
	}

	async createContextMenus() {
		await browser.contextMenus.removeAll();

		console.log('Removed old Context Menus');

		if (!this.config.domain) return;

		/* Parent Context Menu */
		this.contextMenus.parent = browser.contextMenus.create({
			title: 'lolisafe',
			contexts: ['all'],
			onclick: () => browser.tabs.create({ url: this.config.domain + this.config.panelURL }),
		});

		/* Upload */
		browser.contextMenus.create({
			title: 'Send to safe',
			parentId: this.contextMenus.parent,
			contexts: this.contexts,
			onclick: info => this.uploadFile(info.srcUrl, info.pageUrl),
		});

		/* Screenshot Page */
		browser.contextMenus.create({
			title: 'Screenshot page',
			parentId: this.contextMenus.parent,
			contexts: ['page'],
			onclick: () => {
				browser.tabs.captureVisibleTab({ format: 'png' }).then(data => {
					const blob = Helpers.b64toBlob(data.replace('data:image/png;base64,', ''), 'image/png');
					this.uploadScreenshot(blob);
				});
			},
		});

		/* Screenshot Selection */
		browser.contextMenus.create({
			title: 'Screenshot selection',
			parentId: this.contextMenus.parent,
			contexts: ['page'],
			onclick: async () => {
				const tabs = await browser.tabs.query({ active: true, currentWindow: true });
				try {
					await browser.tabs.sendMessage(tabs[0].id, 'check');
				} catch (_) {
					browser.tabs.insertCSS(null, { file: 'css/content.css' });
					await browser.tabs.executeScript(null, { file: 'js/browser-polyfill.min.js' });
					await browser.tabs.executeScript(null, { file: 'js/content.js' });
				} finally {
					browser.tabs.sendMessage(tabs[0].id, 'select');
				}
			},
		});

		if (this.config.token) {
			/* Separator */
			browser.contextMenus.create({
				parentId: this.contextMenus.parent,
				contexts: this.contexts,
				type: 'separator',
			});

			browser.contextMenus.create({
				title: 'Refresh Albums List',
				parentId: this.contextMenus.parent,
				contexts: this.contexts,
				onclick: () => this.createContextMenus(),
			});

			/* Separator */
			browser.contextMenus.create({
				parentId: this.contextMenus.parent,
				contexts: this.contexts,
				type: 'separator',
			});

			const albumsEndpoint = Helpers.versionCompare(this.version, '4.0.0')
				? '/api/albums/dropdown'
				: '/api/albums';

			let res;

			try {
				res = await this.axios.get(albumsEndpoint);
			} catch (error) {
				console.error(error);
				return browser.contextMenus.create({
					title: 'Error Getting Albums',
					parentId: this.contextMenus.parent,
					contexts: this.contexts,
					type: 'normal',
					enabled: false,
				});
			}

			const { albums } = res.data;

			if (!albums) {
				return browser.contextMenus.create({
					title: 'No Albums Available',
					parentId: this.contextMenus.parent,
					contexts: this.contexts,
					type: 'normal',
					enabled: false,
				});
			}

			const lastAlbum = albums.find(a => a.id === this.config.lastAlbum);

			this.contextMenus.lastAlbum = browser.contextMenus.create({
				title: `Upload to: ${lastAlbum ? lastAlbum.name : 'None'}`,
				parentId: this.contextMenus.parent,
				contexts: this.contexts,
				enabled: Boolean(lastAlbum),
				onclick: info => this.uploadFile(info.srcUrl, info.pageUrl, lastAlbum.id, lastAlbum.name),
			});

			/* Separator */
			browser.contextMenus.create({
				parentId: this.contextMenus.parent,
				contexts: this.contexts,
				type: 'separator',
			});

			this.contextMenus.albumsParent = browser.contextMenus.create({
				title: 'Upload to:',
				parentId: this.contextMenus.parent,
				contexts: this.contexts,
				type: 'normal',
				enabled: false,
			});

			albums.forEach(album => {
				console.log(album.id, album.name);
				this.createAlbumContext(album.id, album.name);
			});
		}
	}

	createAlbumContext(id, name, enabled = true) {
		browser.contextMenus.create({
			title: name.replace(/&/g, '&&'),
			parentId: this.contextMenus.parent,
			contexts: this.contexts,
			enabled,
			onclick: info => this.uploadFile(info.srcUrl, info.pageUrl, id, name),
		});
	}

	async uploadFile(url, pageURL, albumID, albumName) {
		const notification = new Notification({
			message: 'Uploading...',
			requireInteraction: true,
		});

		if (albumID) {
			browser.storage.local.set({ lastAlbum: albumID }).then(() => {
				browser.contextMenus.update(this.contextMenus.lastAlbum, {
					title: `Upload to: ${albumName}`,
					enabled: true,
					onclick: info => this.uploadFile(info.srcUrl, info.pageUrl, albumID, albumName),
				});
			}).catch(() => {});
		}

		refererHeader = pageURL;

		try {
			let res = await axios.get(url, { responseType: 'blob' });

			refererHeader = null;

			const data = new FormData();
			data.append('files[]', res.data, `upload${Helpers.fileExt(res.data.type)}`);

			const options = {
				method: 'POST',
				url: '/api/upload',
				data,
				headers: {},
			};

			if (albumID && this.config.token) {
				if (Helpers.versionCompare(this.version, '4.0.0')) {
					options.headers.albumid = albumID;
				} else {
					options.url = `${options.url}/${albumID}`;
				}
			}

			res = await this.axios.request(options);

			const file = Helpers.versionCompare(this.version, '4.0.0')
				? res.data
				: res.data.files[0];

			if (file) {
				const buttons = [{
					title: 'Delete Upload',
					callback: () => this.deleteFile(file),
				}];

				if (!this.config.autoCopyUrl) {
					buttons.unshift({
						title: 'Copy to Clipboard',
						callback: () => Helpers.copyText(file.url),
					});
				}

				notification.update({
					message: 'Upload Complete!',
					contextMessage: file.url,
					buttons,
				});

				if (this.config.autoCopyUrl) {
					Helpers.copyText(file.url);
				}

				notification.clear(5e3);
			} else {
				/* This should only ever fire on instances lower than 4.0 */
				notification.update({
					message: res.data.description || res.data.message,
					contextMessage: url,
				});
			}
		} catch (error) {
			console.error(error);
			notification.update({
				message: error.toString(),
			});
		}
	}

	async uploadScreenshot(blob) {
		const notification = new Notification({
			message: 'Uploading...',
			requireInteraction: true,
		});

		const data = new FormData();
		data.append('files[]', blob, 'upload.png');

		try {
			const res = await this.axios.post('/api/upload', data);

			const file = Helpers.versionCompare(this.version, '4.0.0')
				? res.data
				: res.data.files[0];

			if (file) {
				const buttons = [{
					title: 'Delete Upload',
					callback: () => this.deleteFile(file),
				}];

				if (!this.config.autoCopyUrl) {
					buttons.unshift({
						title: 'Copy to Clipboard',
						callback: () => Helpers.copyText(file.url),
					});
				}

				notification.update({
					message: 'Upload Complete!',
					contextMessage: file.url,
					buttons,
				});

				if (this.config.autoCopyUrl) {
					Helpers.copyText(file.url);
				}

				notification.clear(5e3);
			} else {
				/* This should only ever fire on instances lower than 4.0 */
				notification.update({
					message: res.data.description || res.data.message,
				});
			}
		} catch (error) {
			console.error(error);
			notification.update({
				message: error.toString(),
			});
		}
	}

	async deleteFile(file) {
		try {
			if (Helpers.versionCompare(this.version, '4.0.0')) {
				await this.axios.delete(file.deleteUrl);

				const notification = new Notification({
					message: `File ${file.name} was deleted!`,
				});

				notification.clear(5e3);
			} else {
				let res = await this.axios.get('/api/uploads/0');

				file = res.data.files.find(a => a.name === file.name);

				res = await this.axios.post('/api/upload/delete', { id: file.id });

				const notification = new Notification({
					message: res.data.success
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
	}
}

window.uploader = new LoliSafeUploader();

browser.runtime.onMessage.addListener(request => {
	if ('coordinates' in request) {
		const pos = request.coordinates;

		browser.tabs.captureVisibleTab({ format: 'png' }).then(data => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			const img = new Image();

			img.onload = () => {
				const resHeight = Math.abs(pos[0].y - pos[1].y);
				const resWidth = Math.abs(pos[0].x - pos[1].x);

				if (resHeight === 0 || resWidth === 0) return;

				const posX = pos[0].x < pos[1].x
					? pos[0].x
					: pos[1].x;
				const posY = pos[0].y < pos[1].y
					? pos[0].y
					: pos[1].y;

				canvas.height = resHeight;
				canvas.width = resWidth;

				ctx.drawImage(img, -posX, -posY);

				const imageData = canvas.toDataURL();

				const blob = Helpers.b64toBlob(imageData.replace('data:image/png;base64,', ''), 'image/png');

				window.uploader.uploadScreenshot(blob);
			};

			img.src = data;
		});
	}
});
