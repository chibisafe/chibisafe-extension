console.log('%c chibisafe %c loaded ', 'background:#35495e ; padding: 1px; border-radius: 3px 0 0 3px;  color: #fff', 'background:#ff015b; padding: 1px; border-radius: 0 3px 3px 0; color: #fff');

const $ = el => document.querySelector(el);

function setStyles(element, styles) {
	const el = document.querySelector(element);
	for (const [key, style] of Object.entries(styles)) {
		el.style[key] = style;
	}
}

// Create laso element to be used when selecting the portion of the page to screenshot.
const chibiLasso = document.createElement('div');
chibiLasso.setAttribute('id', 'chibisafe-lasso');
document.body.append(chibiLasso);

let firstPos;
let secondPos;

const captureFunctions = {
	mousedown: event => {
		if (event.buttons !== 1) return;

		setStyles('#chibisafe-lasso', {
			display: 'block',
			top: `${event.clientY}px`,
			left: `${event.clientX}px`,
		});

		firstPos = { x: event.clientX, y: event.clientY };
	},
	mousemove: event => {
		if (event.buttons !== 1) return;

		const originalTop = $('#chibisafe-lasso').style.top;
		const originalLeft = $('#chibisafe-lasso').style.left;

		const height = event.clientY - firstPos.y;
		const width = event.clientX - firstPos.x;

		setStyles('#chibisafe-lasso', {
			top: (height > 0)
				? originalTop
				: `${event.clientY}px`,
			height: (height > 0)
				? `${height}px`
				: `${firstPos.y - event.clientY}px`,
			left: (width > 0)
				? originalLeft
				: `${event.clientX}px`,
			width: (width > 0)
				? `${width}px`
				: `${firstPos.x - event.clientX}px`,
		});
	},
	mouseup: event => {
		if (event.which !== 1) return;

		document.body.classList.remove('chibisafe-filter');

		setStyles('body', {
			cursor: 'initial',
			userSelect: 'initial',
		});

		setStyles('#chibisafe-lasso', {
			display: 'none',
			top: 0,
			left: 0,
			height: 0,
			width: 0,
		});

		secondPos = {
			x: (event.clientX < window.innerWidth)
				? event.clientX
				: window.innerWidth,
			y: (event.clientY < window.innerHeight)
				? event.clientY
				: window.innerHeight,
		};

		document.removeEventListener('mousedown', captureFunctions.mousedown);
		document.removeEventListener('mousemove', captureFunctions.mousemove);
		document.removeEventListener('mouseup', captureFunctions.mouseup);

		setTimeout(() => {
			browser.runtime.sendMessage({
				action: 'screenshotCoordinates',
				data: {
					start: firstPos,
					end: secondPos,
				},
			});
		}, 100);
	},
};

browser.runtime.onMessage.addListener(request => {
	const { action, data } = request;

	switch (action) {
		case 'startScreenshotSelection': {
			setStyles('body', {
				cursor: 'crosshair',
				userSelect: 'none',
			});

			document.body.classList.add('chibisafe-filter');

			document.addEventListener('mousedown', captureFunctions.mousedown);
			document.addEventListener('mousemove', captureFunctions.mousemove);
			document.addEventListener('mouseup', captureFunctions.mouseup);

			break;
		}

		case 'checkIfLoaded': {
			return Promise.resolve(true);
		}

		case 'copyToClipboard': {
			// navigator.clipboard.writeText(data);

			const input = document.createElement('textarea');
			input.value = data;
			input.setAttribute('readonly', '');
			input.style.position = 'absolute';
			input.style.left = '-9999px';
			document.body.append(input);
			input.select();
			document.execCommand('copy');
			input.remove();

			/* const input = document.createElement('textarea');
			input.value = data;
			input.focus();
			input.select();
			document.execCommand('copy');
			input.remove(); */

			break;
		}

		default: {
			return false;
		}
	}

	return false;
});
