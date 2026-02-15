class ElementWrapper {
    /**
     * @param {HTMLElement} element 
     */
    constructor(element) {
        this.element = element;
    }

    /**
     * Checks if the element is visible.
     * @returns {boolean}
     */
    isVisible() {
        if (!this.element) return false;
        // Simple check for now, can be expanded to computed style
        return this.element.style.display !== 'none' && !this.element.classList.contains('hidden');
    }

    /**
     * Shows the element.
     */
    show() {
        if (this.element) this.element.style.display = '';
        return this;
    }

    /**
     * Hides the element.
     */
    hide() {
        if (this.element) this.element.style.display = 'none';
        return this;
    }

    /**
     * Toggles visibility.
     */
    toggle() {
        if (this.isVisible()) {
            this.hide();
        } else {
            this.show();
        }
        return this;
    }

    /**
     * Adds classes.
     * @param {...string} classNames 
     */
    addClass(...classNames) {
        if (this.element) this.element.classList.add(...classNames);
        return this;
    }

    /**
     * Removes classes.
     * @param {...string} classNames 
     */
    removeClass(...classNames) {
        if (this.element) this.element.classList.remove(...classNames);
        return this;
    }

    /**
     * Checks if class exists.
     * @param {string} className 
     */
    hasClass(className) {
        return this.element ? this.element.classList.contains(className) : false;
    }

    /**
     * Gets or sets text content.
     * @param {string} [value] 
     * @returns {string|ElementWrapper}
     */
    text(value) {
        if (value === undefined) {
            return this.element ? this.element.textContent : '';
        }
        if (this.element) this.element.textContent = value;
        return this;
    }

    /**
     * Gets or sets attribute.
     * @param {string} name 
     * @param {string} [value] 
     * @returns {string|ElementWrapper}
     */
    attr(name, value) {
        if (value === undefined) {
            return this.element ? this.element.getAttribute(name) : null;
        }
        if (this.element) this.element.setAttribute(name, value);
        return this;
    }

    /**
     * Gets or sets data attribute.
     * @param {string} key 
     * @param {string} [value] 
     * @returns {string|ElementWrapper}
     */
    data(key, value) {
        if (value === undefined) {
            return this.element ? this.element.dataset[key] : undefined;
        }
        if (this.element) this.element.dataset[key] = value;
        return this;
    }

    /**
     * Finds a descendant element and wraps it.
     * @param {string} selector 
     * @returns {ElementWrapper}
     */
    find(selector) {
        const found = this.element ? this.element.querySelector(selector) : null;
        return new ElementWrapper(found);
    }
    
    /**
     * Finds all descendant elements and returns an array of wrappers.
     * @param {string} selector 
     * @returns {ElementWrapper[]}
     */
    findAll(selector) {
        if (!this.element) return [];
        return Array.from(this.element.querySelectorAll(selector)).map(el => new ElementWrapper(el));
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ElementWrapper;
} else {
    window.ElementWrapper = ElementWrapper;
}
