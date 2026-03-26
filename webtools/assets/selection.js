/**
 * XRay Selection Toolbar
 * Handles element selection mode with hover highlighting and click-to-select.
 */

(function(prompt) {
    return new Promise((resolve) => {
        // Clean up any existing toolbar
        document.getElementById('xray-toolbar')?.remove();
        document.getElementById('xray-styles')?.remove();
        document.querySelectorAll('.xray-highlight').forEach(el => {
            el.classList.remove('xray-highlight');
        });

        // Create toolbar
        const toolbar = document.createElement('div');
        toolbar.id = 'xray-toolbar';
        toolbar.innerHTML = `
            <div class="title"><span class="pulse"></span> Claude is waiting</div>
            <div class="prompt">${prompt}</div>
            <div class="hint">Click on any element to select it</div>
            <div class="buttons">
                <button id="xray-submit" class="primary" disabled>Submit</button>
                <button id="xray-cancel">Cancel</button>
            </div>
        `;
        document.body.appendChild(toolbar);

        let hoveredElement = null;
        let selectedElement = null;

        // Generate a selector for an element
        const getSelector = (el) => {
            if (el.id) return '#' + el.id;
            if (el.className && typeof el.className === 'string') {
                const classes = el.className.trim().split(/\s+/).filter(c => !c.startsWith('xray-'));
                if (classes.length > 0) {
                    return el.tagName.toLowerCase() + '.' + classes.join('.');
                }
            }
            return el.tagName.toLowerCase();
        };

        // Get path from root (last 3 elements)
        const getPath = (el) => {
            const parts = [];
            while (el && el !== document.body) {
                parts.unshift(getSelector(el));
                el = el.parentElement;
            }
            return parts.slice(-3).join(' > ');
        };

        // Get element info
        const getElementInfo = (element) => {
            const rect = element.getBoundingClientRect();
            return {
                success: true,
                selector: getPath(element),
                tagName: element.tagName.toLowerCase(),
                id: element.id || null,
                className: element.className || null,
                text: element.innerText?.substring(0, 200) || null,
                bounds: {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                }
            };
        };

        // Hover effect
        const onMouseOver = (e) => {
            if (e.target === toolbar || toolbar.contains(e.target)) return;
            if (hoveredElement && hoveredElement !== selectedElement) {
                hoveredElement.classList.remove('xray-hover-highlight');
            }
            hoveredElement = e.target;
            if (hoveredElement !== selectedElement) {
                hoveredElement.classList.add('xray-hover-highlight');
            }
        };

        const onMouseOut = (e) => {
            if (e.target === toolbar || toolbar.contains(e.target)) return;
            if (e.target !== selectedElement) {
                e.target.classList.remove('xray-hover-highlight');
            }
        };

        // Click to select
        const onClick = (e) => {
            if (e.target === toolbar || toolbar.contains(e.target)) return;
            e.preventDefault();
            e.stopPropagation();

            // Clear previous selection
            if (selectedElement) {
                selectedElement.classList.remove('xray-selected');
            }

            const element = e.target;
            element.classList.remove('xray-hover-highlight');
            element.classList.add('xray-selected');
            selectedElement = element;

            // Enable submit button
            document.getElementById('xray-submit').disabled = false;
        };

        // Submit button
        const onSubmit = () => {
            if (!selectedElement) return;
            const info = getElementInfo(selectedElement);
            cleanup();
            resolve(info);
        };

        // Cancel button
        const onCancel = () => {
            cleanup();
            resolve({ success: false, cancelled: true });
        };

        const cleanup = () => {
            document.removeEventListener('mouseover', onMouseOver, true);
            document.removeEventListener('mouseout', onMouseOut, true);
            document.removeEventListener('click', onClick, true);
            document.getElementById('xray-toolbar')?.remove();
            document.querySelectorAll('.xray-hover-highlight, .xray-selected').forEach(el => {
                el.classList.remove('xray-hover-highlight', 'xray-selected');
            });
        };

        document.getElementById('xray-submit').addEventListener('click', onSubmit);
        document.getElementById('xray-cancel').addEventListener('click', onCancel);

        document.addEventListener('mouseover', onMouseOver, true);
        document.addEventListener('mouseout', onMouseOut, true);
        document.addEventListener('click', onClick, true);
    });
})(PROMPT_PLACEHOLDER);
