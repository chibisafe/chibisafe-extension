let loliLasso = document.createElement('div');
loliLasso.setAttribute('id', 'loli-lasso');
document.body.appendChild(loliLasso);

let firstPos;
let secondPos;

const captureFunctions = {
	mousedown: (event) => {

		if (event.buttons !== 1) return;

		setStyles('#loli-lasso', {
			display: 'block',
			top: event.clientY + 'px',
			left: event.clientX + 'px'
		});

		firstPos = { x: event.clientX, y: event.clientY };

	},
	mousemove: (event) => {

		if (event.buttons !== 1) return

		const originalTop = $('#loli-lasso').style.top;
		const originalLeft = $('#loli-lasso').style.left;

		const height = event.clientY - firstPos.y;
		const width = event.clientX - firstPos.x;

		setStyles('#loli-lasso', {
			top: (height > 0)
				? originalTop
				: event.clientY + 'px',
			height: (height > 0)
				? height + 'px'
				: (firstPos.y - event.clientY) + 'px',
			left: (width > 0)
				? originalLeft
				: event.clientX + 'px',
			width: (width > 0)
				? width + 'px'
				: (firstPos.x - event.clientX) + 'px'
		});
	},
	mouseup: (event) => {

		if (event.which !== 1) return;

		document.body.classList.remove('loli-filter');

		setStyles('body', {
			cursor: 'initial',
			userSelect: 'initial'
		});

		setStyles('#loli-lasso', {
			display: 'none',
			top: 0, left: 0,
			height: 0, width: 0
		});

		secondPos = {
			x: (event.clientX < window.innerWidth)
				? event.clientX
				: window.innerWidth,
			y: (event.clientY < window.innerHeight)
				? event.clientY
				: window.innerHeight
		};

		document.removeEventListener('mousedown', captureFunctions.mousedown);
		document.removeEventListener('mousemove', captureFunctions.mousemove);
		document.removeEventListener('mouseup', captureFunctions.mouseup);

		setTimeout(() => chrome.runtime.sendMessage({ coordinates: [firstPos, secondPos] }), 100);

	}
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

	if (request === 'select') {

		setStyles('body', {
			cursor: 'crosshair',
			userSelect: 'none'
		});

		document.body.classList.add('loli-filter');

		document.addEventListener('mousedown', captureFunctions.mousedown);
		document.addEventListener('mousemove', captureFunctions.mousemove);
		document.addEventListener('mouseup', captureFunctions.mouseup);

	} else if (request === 'check') {

		sendResponse(true);

	}

});

const $ = (el) => document.querySelector(el);

function setStyles(element, styles) {
	let el = document.querySelector(element);
	for (let style in styles)
		el.style[style] = styles[style];
}