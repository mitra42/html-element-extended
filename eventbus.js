// TODO - add documentation for this - its used (and being developed) in imap client
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