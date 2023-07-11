// A simple event handler to hide the mechanisms
// At the page level create e.g. `const bus = new EventBus`
// At a receiving object typically   bus.register("foo",(evt) => {...})
// At sending end bus.fire("foo",{a: 1, b: 2})
// remove is rarely used, but is ther for completeness.

class EventBus {
    // Copied from https://itnext.io/handling-data-with-web-components-9e7e4a452e6e
    constructor() {
        this._bus = document.createElement('div'); // Never attached to Dom but needed for events
    }

    register(event, callback) {
        this._bus.addEventListener(event, callback);
    }

    remove(event, callback) {
        this._bus.removeEventListener(event, callback);
    }
    fire(event, detail = {}) {
        this._bus.dispatchEvent(new CustomEvent(event, { detail }));
    }
}
export {EventBus}