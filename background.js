chrome.runtime.onInstalled.addListener(function(details) {
	if (details.reason == "update") {
		/* == Made changes to storage names. == */
		chrome.storage.local.clear();
	}
});

const contexts = ["image","video","audio"];

let config;

chrome.storage.local.get(function(items) {
	config = items;
	createContextMenus();
});

chrome.storage.onChanged.addListener(function(changes, namespace) {
	for (key in changes) {
		config[key] = changes[key].newValue;
	}
});

function createContextMenus() {

	if (Object.keys(config).length === 0) return;

	/* == Not the best way to do this but when have I ever done something efficiently? == */
	chrome.contextMenus.removeAll(function() {

		console.log('Removed old Context Menus');

		/* == Parent Context Menu == */
		contextMenus.parent = chrome.contextMenus.create({
			"title": "loli-safe",
			"contexts": contexts
		});

		/* == Refresh == */
		if (config.textAdminToken) {
			chrome.contextMenus.create({
				"title": "Refresh Albums List",
				"parentId": contextMenus.parent,
				"contexts": contexts,
				"onclick": function() {
					createContextMenus();
				}
			});

			/* == Separator == */
			chrome.contextMenus.create({
				"parentId": contextMenus.parent,
				"contexts": contexts,
				"type": "separator"
			});

		}

		/* == Upload normally == */
		chrome.contextMenus.create({
			"title": "Send to safe",
			"parentId": contextMenus.parent,
			"contexts": contexts,
			"onclick": function(info) { upload(info.srcUrl, info.pageUrl) }
		});

		if (config.textAdminToken) {

			/* == Separator == */
			chrome.contextMenus.create({
				"parentId": contextMenus.parent,
				"contexts": contexts,
				"type": "separator"
			});

			axios.get(config.textDomain + '/api/albums', {
				headers: {"auth": config.textAdminToken}
			}).then(function(list) {

				list.data.albums.forEach(function(album) {
					console.log(album.id, album.name);
					contextMenus.createContextMenu(album.id, album.name);
				});

				if (list.data.length === 0) {
					chrome.contextMenus.create({
						"title": "No Albums Available",
						"parentId": contextMenus.parent,
						"contexts": contexts,
						"type": "normal",
						"enabled": false
					});
				}

			}).catch(function(err) {
				chrome.contextMenus.create({
					"title": "Error Getting Albums",
					"parentId": contextMenus.parent,
					"contexts": contexts,
					"type": "normal",
					"enabled": false
				});
			});

		}

	});
}

let contextMenus = {
	"parent": null,
	"children": {},
	"createContextMenu": function(id, name) {
		let CM = chrome.contextMenus.create({
			"title": 'Upload to ' + name,
			"parentId": contextMenus.parent,
			"contexts": contexts,
			"onclick": function(info) {
				upload(info.srcUrl, info.pageUrl, contextMenus.children[info.menuItemId]);
			}
		}, function(a) {
			contextMenus.children[CM] = id; // Binds the Album ID to the Context Menu ID
		});
	}
};

let refererHeader = 'https://google.com';

chrome.webRequest.onBeforeSendHeaders.addListener(function(details) {
	if (details.tabId === -1 && details.method === 'GET') {
		details.requestHeaders.push({
			"name": "Referer",
			"value": refererHeader
		});
		details.requestHeaders.push({
			"name": "Referrer",
			"value": refererHeader
		});
	}
	return {requestHeaders: details.requestHeaders};
}, {urls: ["<all_urls>"]}, ["blocking", "requestHeaders"]);

function upload(url, pageURL, album_id) {
	createNotification('basic', 'Retriving file...', null, null, true);
	refererHeader = pageURL;
	axios.get(url, {responseType: 'blob'}).then(function(file) {
		refererHeader = '';
		createNotification('progress', 'Uploading...', null, 0, true);
		let data = new FormData();
		data.append('files[]', file.data, 'upload' + fileExt(file.data.type));
		let options = {
			headers: {},
			onUploadProgress: function(progress) {
				updateNotification({
					"progress": Math.round((progress.loaded * 100) / progress.total)
				});
			}
		};

		if (album_id && config.textAdminToken) {
			options.headers['album'] = album_id;
			options.headers['adminauth'] = config.textAdminToken;
		}

		if (config.textToken) options.headers['auth'] = config.textToken;

		axios.post(config.textDomain + '/api/upload', data, options).then(function(response) {
			if (response.data.success === true) {
				copyText(response.data.files[0].url);
				createNotification('basic', 'Upload Complete!', 'URL copied to your clipboard!');
			} else {
				createNotification('basic', 'Error', response.data.description);
			}
			clearNotification();
		}).catch(function(err, a) {
			console.log(err, a);
			createNotification('basic', err.toString());
			clearNotification();
		});
	});
}

let mimetypes = {
	"image/png": ".png",
	"image/jpeg": ".jpg",
	"image/gif": ".gif",
	"image/bmp": ".bmp",
	"image/x-icon": ".ico",
	"video/mp4": ".mp4",
	"video/webm":	".webm",
	"video/quicktime": ".mov",
	"audio/mp4": ".mp4a",
	"audio/mpeg": ".mp3",
	"audio/ogg": ".ogg",
	"audio/x-aac": ".aac",
	"audio/x-wav": ".wav"
}

function fileExt(mimetype) {
	return mimetypes[mimetype] || mimetype.split('/')[1];
}

function copyText(text) {
	var input = document.createElement('textarea');
	document.body.appendChild(input);
	input.value = text;
	input.focus();
	input.select();
	document.execCommand('Copy');
	input.remove();
}

function clearNotification(time) {
	setTimeout(function() {chrome.notifications.clear('notifications');}, time || 5000);
}

function updateNotification(options) {
	chrome.notifications.update('notifications', options);
}

function createNotification(type, text, altText, progress, sticky) {
	chrome.notifications.clear('notifications');
	let notificationContent = {
		type: type,
		title: 'loli-safe',
		message: text,
		iconUrl: 'logo-128x128.png',
		requireInteraction: sticky || false
	}
	if (altText && typeof altText === 'string') notificationContent.contextMessage = altText;
	if (progress && typeof progress === 'integer') notificationContent.progress = progress;
	chrome.notifications.create('notifications', notificationContent, function() {
		console.log("Last Error:", chrome.runtime.lastError);
	});
}

chrome.notifications.onClicked.addListener(function() {
	chrome.notifications.clear('notifications');
});
