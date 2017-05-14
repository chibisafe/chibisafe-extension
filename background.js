chrome.runtime.onInstalled.addListener(function(details) {
	if (details.reason == "update") {
		/* == Made changes to storage names. == */
		//chrome.storage.local.clear();
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

	if (Object.keys(config).length === 0 || !config.textDomain) return;

	/* == Not the best way to do this but when have I ever done something efficiently? == */
	chrome.contextMenus.removeAll(function() {

		console.log('Removed old Context Menus');

		/* == Parent Context Menu == */
		contextMenus.parent = chrome.contextMenus.create({
			"title": "loli-safe",
			"contexts": ["all"],
			"onclick": function() {
				chrome.tabs.create({url: config.textDomain + '/dashboard'})
			}
		});

		/* == Refresh == */
		if (config.textToken) {
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

		chrome.contextMenus.create({
			"title": "Screenshot Entire Page",
			"parentId": contextMenus.parent,
			"contexts": ["page"],
			"onclick": function(info) {
				chrome.tabs.captureVisibleTab({
					format: 'png'
				}, function(data) {
					let blob = b64toBlob(data.replace('data:image/png;base64,', ''), 'image/png');
					uploadScreenshot(blob);
				});
			}
		});

		// chrome.contextMenus.create({
		// 	"title": "Screenshot Selection",
		// 	"parentId": contextMenus.parent,
		// 	"contexts": ["page"],
		// 	"onclick": function(info) {
		// 		chrome.tabs.captureVisibleTab({
		// 			format: 'png'
		// 		}, function() {
		// 			chrome.tabs.query({"active": true}, function(tabs) {
		// 				chrome.tabs.sendMessage(tabs[0].id, {action: 1});
		// 			});
		// 		});
		// 	}
		// });

		if (config.textToken) {

			/* == Separator == */
			chrome.contextMenus.create({
				"parentId": contextMenus.parent,
				"contexts": contexts,
				"type": "separator"
			});

			axios.get(config.textDomain + '/api/albums', {
				headers: {"token": config.textToken}
			}).then(function(list) {

				if (list.data.albums.length === 0) {

					chrome.contextMenus.create({
						"title": "No Albums Available",
						"parentId": contextMenus.parent,
						"contexts": contexts,
						"type": "normal",
						"enabled": false
					});

				} else {

					chrome.contextMenus.create({
						"title": "Upload to:",
						"parentId": contextMenus.parent,
						"contexts": contexts,
						"type": "normal",
						"enabled": false
					});

					list.data.albums.forEach(function(album) {
						console.log(album.id, album.name);
						contextMenus.createContextMenu(album.id, album.name);
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
			"title": name.replace('&', '&&'),
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

let refererHeader = null;

/* == We need to set this header for image sources that check it for auth or to prevent hotlinking == */
chrome.webRequest.onBeforeSendHeaders.addListener(function(details) {
	if (details.tabId === -1 && details.method === 'GET' && refererHeader !== null) {
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

	let notification = notifications.create('basic', 'Retriving file...', null, true);

	refererHeader = pageURL; // Sets the Page URl as the referer url

	axios.get(url, {responseType: 'blob'}).then(function(file) {

		refererHeader = null; // Set to null after we're done with it

		notifications.update(notification, {
			type: 'progress',
			message: 'Uploading...',
			progress: 0
		});

		let data = new FormData();
		data.append('files[]', file.data, 'upload' + fileExt(file.data.type));

		let options = {
			method: 'POST',
			url: config.textDomain + '/api/upload',
			data: data,
			headers: {},
			onUploadProgress: function(progress) {
				notifications.update(notification, {
					"progress": Math.round((progress.loaded * 100) / progress.total)
				});
			}
		};

		if (config.textToken) options.headers['token'] = config.textToken;

		if (album_id && config.textToken) {
			options.url = options.url + '/' + album_id;
		}

		axios.request(options).then(function(response) {
			if (response.data.success === true) {
				copyText(response.data.files[0].url);
				notifications.update(notification, {
					type: 'basic',
					message: 'Upload Complete!',
					contextMessage: 'URL copied to your clipboard!',
				});
				notifications.clear(notification, 5000);
			} else {
				notifications.update(notification, {
					type: 'basic',
					message: response.data.description,
					contextMessage: url,
				});
			}
		}).catch(function(err) {
			console.log(err);
			notifications.update(notification, {
				type: 'basic',
				message: err.toString(),
				contextMessage: url,
			});
		});

	});

}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if ('coordinates' in request) {
		console.log(request.coordinates);
	}
});

function uploadScreenshot(blob, album_id) {

	let notification = notifications.create('progress', 'Uploading...', null, true, 0);

	let data = new FormData();
	data.append('files[]', blob, 'upload.png');

	let options = {
		method: 'POST',
		url: config.textDomain + '/api/upload',
		data: data,
		headers: {},
		onUploadProgress: function(progress) {
			notifications.update(notification, {
				"progress": Math.round((progress.loaded * 100) / progress.total)
			});
		}
	};

	if (config.textToken) options.headers['token'] = config.textToken;

	if (album_id && config.textToken) {
		options.url = options.url + '/' + album_id;
	}

	axios.request(options).then(function(response) {
		if (response.data.success === true) {
			copyText(response.data.files[0].url);
			notifications.update(notification, {
				type: 'basic',
				message: 'Upload Complete!',
				contextMessage: response.data.files[0].url,
			});
			notifications.clear(notification, 5000);
		} else {
			notifications.update(notification, {
				type: 'basic',
				message: 'Error!',
				contextMessage: response.data.description,
			});
		}
	}).catch(function(err, a) {
		console.log(err, a);
		notifications.update(notification, {
			type: 'basic',
			message: 'Error!',
			contextMessage: err.toString(),
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

  let blob = new Blob(byteArrays, {type: contentType});
  return blob;
}

var notifications = {
	"active": new Set(),
	"create": function(type, text, altText, sticky, progress) {
		let notificationContent = {
			type: type,
			title: 'loli-safe',
			message: text,
			iconUrl: 'logo-128x128.png',
			requireInteraction: sticky || false
		}
		if (altText && typeof altText === 'string') notificationContent.contextMessage = altText;
		if (progress && typeof progress === 'integer') notificationContent.progress = progress;
		let id = 'notification_' + Date.now();
		chrome.notifications.create(id, notificationContent, function() {
			notifications.active.add(id);
		});
		return id;
	},
	"update": function(id, options) {
		chrome.notifications.update(id, options);
	},
	"clear": function(id, timeout) {
		setTimeout(function() {
			chrome.notifications.clear(id);
		}, timeout || 0);
	}
}

chrome.notifications.onClicked.addListener(function(id) {
	chrome.notifications.clear(id);
});

chrome.notifications.onClosed.addListener(function(id) {
	notifications.active.delete(id);
});
