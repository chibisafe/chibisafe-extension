const MIMETYPES = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/svg+xml': 'svg',
	'image/gif': 'gif',
	'image/bmp': 'bmp',
	'image/x-icon': 'ico',
	'video/mp4': 'mp4',
	'video/webm': 'webm',
	'video/quicktime': 'mov',
	'audio/mp4': 'mp4a',
	'audio/mpeg': 'mp3',
	'audio/ogg': 'ogg',
	'audio/x-aac': 'aac',
	'audio/x-wav': 'wav'
};

export function getFileExtension(url: string, file: Blob) {
	let fileExtension = MIMETYPES[file.type as keyof typeof MIMETYPES];

	if (!fileExtension) {
		const potentialFilename = new URL(url).pathname.split('/').pop();
		const ext = potentialFilename?.split('.').pop();

		if (ext && Object.values(MIMETYPES).includes(ext)) {
			fileExtension = ext;
		}
	}

	return fileExtension ? `.${fileExtension}` : '';
}
