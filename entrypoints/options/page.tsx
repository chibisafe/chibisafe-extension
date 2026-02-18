import Logo from '@/assets/logo.svg';
import { Panel } from '@/components/Panel';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/Checkbox';
import { TextField } from '@/components/ui/TextField';

export default function Page() {
	const [siteUrl, setSiteUrl] = useState<string | undefined>(undefined);
	const [apiKey, setApiKey] = useState<string | undefined>(undefined);
	const [showRecentAlbums, setShowRecentAlbums] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState(false);
	const [username, setUsername] = useState<string | undefined>(undefined);
	const [albumCount, setAlbumCount] = useState<number | undefined>(undefined);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsLoading(true);
		const formData = new FormData(e.target as HTMLFormElement);
		const siteUrl = formData.get('siteUrl') as string;
		const apiKey = formData.get('apiKey') as string;

		await browser.storage.local.set({
			siteUrl: siteUrl,
			apiKey: apiKey,
			showRecentAlbums: showRecentAlbums
		});

		await browser.runtime.sendMessage({ type: 'saveSettings' });
		await checkDetails();
		setIsLoading(false);
	};

	const checkDetails = async () => {
		let version = '7';
		if (await isVersion6()) version = '6';
		await browser.storage.local.set({ version });

		await fetchUser(version);
		await fetchAlbumCount(version);
	};

	const fetchUser = async (version: string) => {
		if (!siteUrl || !apiKey) return;
		const url = version === '7' ? `${siteUrl}/api/v1/users/me` : `${siteUrl}/api/user/me`;

		try {
			const response = await fetch(url, {
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': apiKey
				}
			});
			const data = await response.json();
			setUsername(version === '7' ? data.username : data.user.username);
		} catch (e) {
			console.warn('Failed to fetch user', e);
		}
	};

	const fetchAlbumCount = async (version: string) => {
		if (!siteUrl || !apiKey) return;
		const url = version === '7' ? `${siteUrl}/api/v1/folders?limit=1000` : `${siteUrl}/api/albums?limit=1000`;

		try {
			const response = await fetch(url, {
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': apiKey
				}
			});
			const data = await response.json();
			setAlbumCount(data.count);
		} catch (e) {
			console.warn('Failed to fetch albums', e);
		}
	};

	const isVersion6 = async (): Promise<boolean> => {
		if (!siteUrl || !apiKey) return false;

		try {
			const response = await fetch(`${siteUrl}/api/version`);
			const data = await response.json();
			if (data.error) return false;

			return true;
		} catch (e) {
			console.warn('Failed to fetch version', e);
		}

		return false;
	};

	useEffect(() => {
		(async () => {
			const { siteUrl, apiKey, showRecentAlbums } = await browser.storage.local.get([
				'siteUrl',
				'apiKey',
				'showRecentAlbums'
			]);

			if (siteUrl && apiKey) {
				setSiteUrl(siteUrl);
				setApiKey(apiKey);
				setShowRecentAlbums(showRecentAlbums);
			}
		})();
	}, []);

	return (
		<div className="flex flex-col gap-8 justify-center items-center">
			<img src={Logo} alt="chibisafe logo" className="w-32" />
			<h1 className="font-inter text-2xl font-bold">chibisafe settings</h1>
			<p className="text-default text-base text-center">
				This chibisafe uploader is a tool that allows you to upload files to a chibisafe instance directly from your
				browser.
				<br />
				Make sure to set the instance URL and API key in the form below so that the extension can upload files and pull
				album information from your chibisafe instance.
			</p>

			{siteUrl && apiKey && (
				<Panel title="Account information" className="flex flex-col gap-4">
					<div className="flex flex-col gap-4 text-sm">
						<p>
							Logged in as <span className="font-bold">{username}</span>
						</p>
						<p>
							Number of folders: <span className="font-bold">{albumCount}</span>
						</p>
						<Button variant="filled" onClick={checkDetails}>
							Check details
						</Button>
					</div>
				</Panel>
			)}

			<form className="*:not-first:mt-2 w-full max-w-xl flex flex-col gap-4" onSubmit={handleSubmit}>
				<Panel title="Settings" className="flex flex-col gap-4">
					<TextField
						label="chibisafe instance URL"
						name="siteUrl"
						placeholder="https://your-chibisafe-instance.com"
						value={siteUrl}
						isRequired
						onInput={e => setSiteUrl((e.target as HTMLInputElement).value)}
					/>
					<TextField
						label="chibisafe API key"
						name="apiKey"
						placeholder="API key"
						value={apiKey}
						isRequired
						onInput={e => setApiKey((e.target as HTMLInputElement).value)}
					/>

					<Checkbox
						description="This will show the recent albums you used in the uploader popup for quick access"
						label="Show recent albums"
						isSelected={showRecentAlbums}
						onChange={value => setShowRecentAlbums(value)}
					/>
				</Panel>
				<div className="flex flex-row justify-end">
					<Button variant="filled" type="submit" isPending={isLoading} isDisabled={isLoading}>
						Save
					</Button>
				</div>
			</form>
		</div>
	);
}
