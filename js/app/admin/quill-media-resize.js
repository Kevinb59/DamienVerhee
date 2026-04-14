/**
 * Redimensionnement des images et des iframes vidéo (blot Quill « video ») dans l’admin.
 * Largeur en px (attribut HTML width), hauteur retirée : ratio conservé via CSS aspect-ratio sur les iframes.
 * Clic sur une iframe YouTube : interception en phase capture (sinon l’iframe absorbe l’événement).
 */

/* global Quill */

/**
 * Média redimensionnable présent dans l’éditeur.
 * @typedef {HTMLImageElement | HTMLIFrameElement} QuillResizeableEl
 */

/**
 * @param {import('quill').default} quill
 */
export function setupQuillMediaResize(quill) {
	const editorEl = quill.root;
	const wrap = document.querySelector('.dv-admin__quill-wrap');
	if (!wrap || !editorEl) {
		return;
	}

	const bar = document.createElement('div');
	bar.className = 'dv-admin__image-size-bar';
	bar.setAttribute('hidden', '');
	bar.innerHTML = `
		<div class="dv-admin__image-size-bar__inner">
			<label class="dv-admin__image-size-bar__label">
				<span class="dv-admin__image-size-bar__title">Largeur dans l’article</span>
				<input type="range" class="dv-admin__image-size-bar__range" min="10" max="100" value="100" aria-valuemin="10" aria-valuemax="100" />
				<span class="dv-admin__image-size-bar__pct" aria-live="polite">100&nbsp;%</span>
			</label>
			<button type="button" class="button small dv-admin__image-size-bar__reset">Taille d’origine</button>
		</div>
		<p class="dv-admin__image-size-bar__hint dv-admin__image-size-bar__hint--dynamic"></p>
	`;
	wrap.appendChild(bar);

	const hintEl = bar.querySelector('.dv-admin__image-size-bar__hint--dynamic');
	const titleEl = bar.querySelector('.dv-admin__image-size-bar__title');
	const range = /** @type {HTMLInputElement} */ (bar.querySelector('.dv-admin__image-size-bar__range'));
	const pctLabel = bar.querySelector('.dv-admin__image-size-bar__pct');
	const btnReset = bar.querySelector('.dv-admin__image-size-bar__reset');

	/** @type {QuillResizeableEl | null} */
	let activeEl = null;
	/** @type {{ update: () => void; destroy: () => void } | null} */
	let overlayCtl = null;

	function isImageBlot(blot) {
		if (!blot || typeof blot !== 'object') {
			return false;
		}
		const Ctor = /** @type {{ blotName?: string }} */ (blot).constructor;
		return Ctor?.blotName === 'image';
	}

	function isVideoBlot(blot) {
		if (!blot || typeof blot !== 'object') {
			return false;
		}
		const Ctor = /** @type {{ blotName?: string }} */ (blot).constructor;
		return Ctor?.blotName === 'video';
	}

	/**
	 * @param {Element} el
	 */
	function getMediaBlot(el) {
		const blot = Quill.find(el);
		if (isImageBlot(blot) || isVideoBlot(blot)) {
			return blot;
		}
		return null;
	}

	/**
	 * Trouve une image ou iframe vidéo sous le point (clientX, clientY).
	 * @param {number} x
	 * @param {number} y
	 * @returns {QuillResizeableEl | null}
	 */
	function findMediaAtPoint(x, y) {
		for (const fr of editorEl.querySelectorAll('iframe.ql-video')) {
			if (!(fr instanceof HTMLIFrameElement)) {
				continue;
			}
			const r = fr.getBoundingClientRect();
			if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
				return fr;
			}
		}
		for (const img of editorEl.querySelectorAll('img')) {
			if (!(img instanceof HTMLImageElement)) {
				continue;
			}
			const r = img.getBoundingClientRect();
			if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
				return img;
			}
		}
		return null;
	}

	function editorContentWidth() {
		return Math.max(120, editorEl.clientWidth);
	}

	/**
	 * @param {QuillResizeableEl} el
	 * @param {number} px
	 */
	function applyWidthPx(el, px) {
		const blot = getMediaBlot(el);
		if (!blot) {
			return;
		}
		const w = Math.max(32, Math.round(px));
		blot.format('width', String(w));
		blot.format('height', false);
	}

	/**
	 * @param {QuillResizeableEl} el
	 */
	function currentDisplayWidth(el) {
		const attr = el.getAttribute('width');
		if (attr && !Number.isNaN(parseInt(attr, 10))) {
			return parseInt(attr, 10);
		}
		return el.getBoundingClientRect().width;
	}

	/**
	 * @param {QuillResizeableEl} el
	 */
	function syncRangeFromMedia(el) {
		const ew = editorContentWidth();
		const dw = currentDisplayWidth(el);
		const pct = Math.min(100, Math.max(10, Math.round((dw / ew) * 100)));
		range.value = String(pct);
		if (pctLabel) {
			pctLabel.innerHTML = `${pct}&nbsp;%`;
		}
	}

	/**
	 * @param {QuillResizeableEl} el
	 */
	function updateHints(el) {
		if (el instanceof HTMLIFrameElement) {
			if (titleEl) {
				titleEl.textContent = 'Largeur de la vidéo';
			}
			if (hintEl) {
				hintEl.textContent =
					'Curseur ou poignée — format 16:9 conservé. Collez un lien YouTube ou Vimeo via le bouton vidéo de la barre d’outils.';
			}
		} else {
			if (titleEl) {
				titleEl.textContent = 'Largeur dans l’article';
			}
			if (hintEl) {
				hintEl.textContent = 'Curseur ou poignée sous l’image — proportions conservées.';
			}
		}
	}

	function destroyOverlay() {
		if (overlayCtl) {
			overlayCtl.destroy();
			overlayCtl = null;
		}
	}

	function hideBar() {
		bar.setAttribute('hidden', '');
		activeEl = null;
		destroyOverlay();
	}

	/**
	 * @param {QuillResizeableEl} el
	 */
	function attachResizeOverlay(el) {
		destroyOverlay();
		const handle = document.createElement('button');
		handle.type = 'button';
		handle.className = 'dv-admin__image-resize-handle';
		handle.title = 'Redimensionner (ratio conservé)';
		handle.setAttribute('aria-label', 'Redimensionner en conservant les proportions');
		document.body.appendChild(handle);

		function layout() {
			if (!el.isConnected) {
				return;
			}
			const r = el.getBoundingClientRect();
			const size = 14;
			handle.style.left = `${Math.round(r.right - size - 2)}px`;
			handle.style.top = `${Math.round(r.bottom - size - 2)}px`;
		}

		layout();
		let ro = null;
		if (typeof ResizeObserver !== 'undefined') {
			ro = new ResizeObserver(layout);
			ro.observe(editorEl);
		}
		window.addEventListener('scroll', layout, true);
		window.addEventListener('resize', layout);

		let startX = 0;
		let startW = 0;
		let dragging = false;

		handle.addEventListener('pointerdown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			dragging = true;
			startX = e.clientX;
			startW = currentDisplayWidth(el);
			handle.setPointerCapture(e.pointerId);
		});
		handle.addEventListener('pointermove', (e) => {
			if (!dragging) {
				return;
			}
			const dx = e.clientX - startX;
			const maxW = editorContentWidth();
			const next = Math.min(maxW, Math.max(32, startW + dx));
			applyWidthPx(el, next);
			syncRangeFromMedia(el);
			layout();
		});
		handle.addEventListener('pointerup', () => {
			dragging = false;
			layout();
		});
		handle.addEventListener('pointercancel', () => {
			dragging = false;
		});

		overlayCtl = {
			update: layout,
			destroy: () => {
				if (ro) {
					ro.disconnect();
				}
				window.removeEventListener('scroll', layout, true);
				window.removeEventListener('resize', layout);
				handle.remove();
			},
		};
	}

	/**
	 * @param {QuillResizeableEl} el
	 */
	function selectMediaBlot(el) {
		const blot = getMediaBlot(el);
		if (!blot) {
			return false;
		}
		const index = quill.getIndex(blot);
		quill.setSelection(index, 1, 'user');
		return true;
	}

	/**
	 * @param {QuillResizeableEl} el
	 */
	function activateMedia(el) {
		activeEl = el;
		bar.removeAttribute('hidden');
		updateHints(el);
		syncRangeFromMedia(el);
		attachResizeOverlay(el);
	}

	/**
	 * Clic / pointeur : phase capture pour intercepter avant l’iframe (cross-origin).
	 * @param {MouseEvent | PointerEvent} e
	 */
	function onEditorPointerActivate(e) {
		const x = e.clientX;
		const y = e.clientY;
		const media = findMediaAtPoint(x, y);
		if (!media) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		if (!selectMediaBlot(media)) {
			return;
		}
		activateMedia(media);
	}

	editorEl.addEventListener('pointerdown', onEditorPointerActivate, true);

	document.addEventListener('pointerdown', (e) => {
		const t = e.target;
		if (bar.contains(t)) {
			return;
		}
		if (t instanceof Element && t.closest('.dv-admin__image-resize-handle')) {
			return;
		}
		if (findMediaAtPoint(e.clientX, e.clientY)) {
			return;
		}
		hideBar();
	});

	range.addEventListener('input', () => {
		if (!activeEl) {
			return;
		}
		const pct = Number(range.value);
		if (pctLabel) {
			pctLabel.innerHTML = `${pct}&nbsp;%`;
		}
		const px = (editorContentWidth() * pct) / 100;
		applyWidthPx(activeEl, px);
		overlayCtl?.update();
	});

	btnReset?.addEventListener('click', () => {
		if (!activeEl) {
			return;
		}
		const blot = getMediaBlot(activeEl);
		if (!blot) {
			return;
		}
		blot.format('width', false);
		blot.format('height', false);
		syncRangeFromMedia(activeEl);
		overlayCtl?.update();
	});

	quill.on('selection-change', (range) => {
		function hideUnlessBarFocused() {
			requestAnimationFrame(() => {
				if (!bar.contains(document.activeElement)) {
					hideBar();
				}
			});
		}
		if (bar.contains(document.activeElement)) {
			return;
		}
		if (!range || range.length !== 1) {
			hideUnlessBarFocused();
			return;
		}
		const [leaf] = quill.getLeaf(range.index);
		const node = leaf && /** @type {{ domNode?: unknown }} */ (leaf).domNode;
		if (!(node instanceof HTMLImageElement) && !(node instanceof HTMLIFrameElement)) {
			hideUnlessBarFocused();
			return;
		}
		if (!getMediaBlot(node)) {
			hideUnlessBarFocused();
			return;
		}
		activateMedia(/** @type {QuillResizeableEl} */ (node));
	});

	quill.on('text-change', () => {
		if (activeEl && !editorEl.contains(activeEl)) {
			hideBar();
		} else {
			overlayCtl?.update();
		}
	});
}
