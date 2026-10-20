// Simple Spatial Navigation for TV Remotes (Fire TV, Android TV, webOS, Tizen)
(function() {
    const FOCUSABLE_SELECTOR = 'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

    function getFocusableElements() {
        return Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none' && !el.disabled;
        });
    }

    function getDistance(rect1, rect2, direction) {
        let dx = 0, dy = 0;
        
        const center1 = { x: rect1.left + rect1.width / 2, y: rect1.top + rect1.height / 2 };
        const center2 = { x: rect2.left + rect2.width / 2, y: rect2.top + rect2.height / 2 };

        if (direction === 'left') {
            if (center2.x >= center1.x) return Infinity;
            dx = center1.x - center2.x;
            dy = center1.y - center2.y;
        } else if (direction === 'right') {
            if (center2.x <= center1.x) return Infinity;
            dx = center2.x - center1.x;
            dy = center1.y - center2.y;
        } else if (direction === 'up') {
            if (center2.y >= center1.y) return Infinity;
            dx = center1.x - center2.x;
            dy = center1.y - center2.y;
        } else if (direction === 'down') {
            if (center2.y <= center1.y) return Infinity;
            dx = center1.x - center2.x;
            dy = center2.y - center1.y;
        }

        // Weight primary direction more heavily
        if (direction === 'left' || direction === 'right') {
            return dx + (Math.abs(dy) * 3);
        } else {
            return dy + (Math.abs(dx) * 3);
        }
    }

    function navigate(direction) {
        const activeElement = document.activeElement;
        const focusable = getFocusableElements();
        
        if (focusable.length === 0) return;

        if (!activeElement || activeElement === document.body || !focusable.includes(activeElement)) {
            focusable[0].focus();
            return;
        }

        const activeRect = activeElement.getBoundingClientRect();
        let closest = null;
        let minDistance = Infinity;

        focusable.forEach(el => {
            if (el === activeElement) return;
            const rect = el.getBoundingClientRect();
            const distance = getDistance(activeRect, rect, direction);
            
            if (distance < minDistance) {
                minDistance = distance;
                closest = el;
            }
        });

        if (closest) {
            closest.focus();
            // Ensure smooth scrolling to the focused element
            closest.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    }

    window.addEventListener('keydown', function(e) {
        // Fire TV remote uses Arrow keys and Enter
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                navigate('up');
                break;
            case 'ArrowDown':
                e.preventDefault();
                navigate('down');
                break;
            case 'ArrowLeft':
                e.preventDefault();
                navigate('left');
                break;
            case 'ArrowRight':
                e.preventDefault();
                navigate('right');
                break;
            case 'Enter':
                // Let default behavior happen (click)
                break;
        }
    });
    
    // Add CSS to make focused elements clearly visible on TV
    const style = document.createElement('style');
    style.innerHTML = `
        *:focus-visible {
            outline: 3px solid #00ffcc !important;
            outline-offset: 2px !important;
            box-shadow: 0 0 15px rgba(0, 255, 204, 0.7) !important;
            transform: scale(1.02);
            transition: all 0.2s ease-in-out;
            z-index: 50;
        }
    `;
    document.head.appendChild(style);

    // Initial focus after a short delay to allow rendering
    setTimeout(() => {
        if (document.activeElement === document.body) {
            const first = getFocusableElements()[0];
            if (first) first.focus();
        }
    }, 1000);
})();
