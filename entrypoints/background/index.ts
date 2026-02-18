import { getFileExtension } from '@/lib/utils';
import { browser } from 'wxt/browser';
import type { Album } from '../content/App';

export default defineBackground(() => {
	let urlToUpload: string | null = null;

	const fetchAlbums = async () => {
		const { siteUrl, apiKey, version } = await browser.storage.local.get(['siteUrl', 'apiKey', 'version']);
		if (!siteUrl || !apiKey) return;

		try {
			const headers = {
				'Content-Type': 'application/json',
				'X-API-Key': apiKey
			};

			const url = version === '7' ? `${siteUrl}/api/v1/folders?limit=1000` : `${siteUrl}/api/albums?limit=1000`;
			const response = await fetch(url, {
				headers
			});
			const data = await response.json();
			let albums: Album[] = [];

			if (version === '7') {
				albums = data.results.map((folder: Album) => ({
					uuid: folder.uuid,
					name: folder.name
				}));
			} else {
				albums = data.albums.map((album: Album) => ({
					uuid: album.uuid,
					name: album.name
				}));
			}

			const { currentAlbums } = await browser.storage.local.get('albums');
			if (JSON.stringify(currentAlbums) === JSON.stringify(albums)) {
				return false;
			}

			await browser.storage.local.set({ albums });
			return true;
		} catch (e) {
			console.warn('Failed to fetch albums', e);
		}
	};

	const hasValidApiKey = async () => {
		const { apiKey } = await browser.storage.local.get('apiKey');
		return !!apiKey;
	};

	const upload = async (albumUuid: string, pageUrl: string, tabId: number) => {
		const { siteUrl, apiKey, version } = await browser.storage.local.get(['siteUrl', 'apiKey', 'version']);
		if (!siteUrl || !apiKey) return;
		if (!urlToUpload) return;

		// console.log('uploading', urlToUpload, albumUuid, pageUrl);
		// console.log('siteUrl', siteUrl);
		// console.log('apiKey', apiKey);

		const ruleId = Math.floor(Math.random() * 5000);
		await browser.declarativeNetRequest.updateSessionRules({
			addRules: [
				{
					id: ruleId,
					priority: 1,
					action: {
						type: 'modifyHeaders',
						requestHeaders: [
							{
								header: 'Referer',
								operation: 'set',
								value: pageUrl
							}
						]
					},
					condition: {
						urlFilter: urlToUpload
					}
				}
			]
		});

		try {
			const dataToUpload = await fetch(urlToUpload).then(res => res.blob());
			if (!dataToUpload) {
				console.error('Failed to fetch data to upload');
				return;
			}

			const fileExtension = getFileExtension(urlToUpload, dataToUpload);

			const formData = new FormData();
			formData.append('file[]', dataToUpload, `upload${fileExtension}`);

			const response = await fetch(`${siteUrl}/api/${version === '7' ? 'v1/' : ''}upload`, {
				method: 'POST',
				headers: {
					...(apiKey && { 'X-API-Key': apiKey }),
					...(albumUuid && { albumuuid: albumUuid }),
					...(pageUrl && { 'x-source-url': pageUrl })
				},
				body: formData
			});

			const data = await response.json();

			const isTabStillOpen = await browser.tabs.get(tabId);
			if (isTabStillOpen) {
				browser.tabs.sendMessage(tabId, { type: 'uploadSuccess', data: data });
			}
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} catch (e: any) {
			const isTabStillOpen = await browser.tabs.get(tabId);
			if (isTabStillOpen) {
				browser.tabs.sendMessage(tabId, { type: 'uploadError', data: e.toString() });
			}

			console.error('Failed to upload');
			const data = (await e.json?.()) ?? e;
			console.error(e, data);
		} finally {
			await browser.declarativeNetRequest.updateSessionRules({
				removeRuleIds: [ruleId]
			});
		}
	};

	const addAlbumToRecentAlbums = async (album: Album) => {
		const { recentAlbums } = await browser.storage.local.get('recentAlbums');

		const strippedAlbum = {
			uuid: album.uuid,
			name: album.name
		};

		if (recentAlbums?.length) {
			const filteredAlbums = recentAlbums.filter((a: Album) => a.uuid !== strippedAlbum.uuid);
			const newRecentAlbums = [strippedAlbum, ...filteredAlbums].slice(0, 5);
			browser.storage.local.set({ recentAlbums: newRecentAlbums });
		} else {
			browser.storage.local.set({ recentAlbums: [strippedAlbum] });
		}
	};

	browser.contextMenus.create({
		id: 'chibisafe',
		title: 'Upload to chibisafe',
		contexts: ['image', 'video', 'audio']
	});

	browser.runtime.onMessage.addListener(async (message, sender) => {
		if (!sender.tab?.id) return;
		switch (message.type) {
			case 'close':
				await browser.tabs.sendMessage(sender.tab.id, { type: 'unloadUI' });
				break;
			case 'saveSettings':
				void fetchAlbums();
				break;
			case 'getAlbums':
				// biome-ignore lint/correctness/noSwitchDeclarations: <explanation>
				const updated = await fetchAlbums();
				if (updated) {
					browser.tabs.sendMessage(sender.tab.id, { type: 'fetchAlbumsFromCache' });
				}
				break;
			case 'openSettingsPage':
				browser.runtime.openOptionsPage();
				break;
			case 'upload':
				await upload(message.data.albumUuid, message.data.pageUrl, sender.tab.id);
				break;
			case 'addAlbumToRecentAlbums':
				await addAlbumToRecentAlbums(message.data.album);
				break;
			default:
				console.warn('Unknown message type', message);
				break;
		}
	});

	browser.contextMenus.onClicked.addListener(async (info, tab) => {
		if (info.menuItemId === 'chibisafe' && info.srcUrl) {
			if (!(await hasValidApiKey())) {
				browser.runtime.openOptionsPage();
				return;
			}

			try {
				if (!tab?.id) return;
				await browser.tabs.sendMessage(tab.id, { type: 'loadUI' });
				urlToUpload = info.srcUrl;
			} catch (e) {
				console.warn('Failed to open uploader', e);
			}
		}
	});
});
