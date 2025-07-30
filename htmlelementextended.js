/* Summary
  GETp(httpurl, opts) - asynchronous function returns promise that resolves to json or rejects on error
  GET(httpurl, opts, cb(err, json)) - calls cb with json or err
  EL(tag, { attributes }, [ children ]) return a new element.
    Semi-intelligent attribute handling of textContent, onsubmit, onclick, innerHTML, style,
    and where attribute is object or undefined
    nested arrays of children are flattened and undefined/null eliminated
  getUrl(domain, {args})  Return a suitable URL by passing args through as parameters and encoding
  ErrorLoadingWrapper({url, qdata, err}, children)
    Wrap around a function if want to replace with an error message if err, or "Loading" if no data yet
  class HTMLElementExtended
  - never used directly, it is a base class, extends HTMLElement, and is itself extended for each webcomponent
  - for documentation see the class
*/
/*

  //Generally to construct a new Element class this is an example
  const Tstyle = `span {color: red}`; // Define any styles for this element
  const MyBar extends HTMLElementExtended {
    // constructor() { super(); } // Only subclass constructor if adding something, but call super() if do so.
    loadContent() { // If defined it will call this when the element is defined enough to pass the test at shouldLoadWhenConnected
        this.loadSetRenderAndReplace(`/foo.json`, { case: this.state.myparm }, (err)=>{}); // Call a URL often passing state in the query, can postprocess using this.state.data
    }
    shouldLoadWhenConnected() { return !this.state.mydata && this.state.myparm}; // a test to define when it needs loading
    static get observedAttributes() { return ['myparm']; }; // Tell it what parms to load - note these are string parms, not objects which are handled differently
    render() {
            return [
              EL('style' {textContent: Tstyle}) ); // Using styles defined above
              EL('link', {rel: 'stylesheet', href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css" }); // Or on the net
              EL('span', {textContent: "I am a T"}),
            ]; // build an element tree for this element
    }
    changeAttribute(name, newValue) {super.changeAttribute(name, name = "x" ? f(newValue): newValue) } // Useful preprocess of attributes
  }
  customElements.define('my-bar', MyBar); // Pass it to browser, note it MUST be xxx-yyy
*/

/*
  Component lifestyle and methods called
  Typically an item is created by some other render calling EL('foo-bar'....)
  This calls the constructor() which defines this.state and creates shadow DOM
  Then the browser sets each attribute, each calls attributeChangedCallback() which:
  - sets state, munging values as needed.
  - The object is not connected, so it does not load content yet
  - It calls renderAndReplace for the first time
  RenderAndReplace does a render, but since isLoaded will be false it calls renderLoaded
  which renders as "Loading"

  The Browser attaches this subtree to the DOM and connectedCallback (CCB) is triggered
  CCB checks shouldLoadWhenConnected which returns true since attributes are set so
  CCB calls loadContent
  Before loadContent can complete it calls renderAndReplace again which should still be "Loading"

  loadContent is subclassed, but typically just calls loadSetRenderAndReplace (LSRR)
  LSRR asynchronously fetches a URL, converts to JSON and sets it in the this.state.data
  LSRR then calls renderAndReplace (RR) which calls render
  if there has been an error render calls renderError which by default displays message and URL
  render now calls renderLoaded which is always subclassed
  renderLoaded builds the subtree for this object (potentially with similar lifecycle)

  If an attribute is changed (which is less usual) then attributeChangedCallback (ACC) is called.
  ACC uses changeAttribute to munge and save the value
  This time when ACC checks, the object isConnected and probably loadable
  It will do a render (RR->RenderLoaded) that reflects the changed attribute
  And loadContent -> loadSetRenderAndReplace to update any data and re-render.
*/

// For now using yaml imported by caller
// import yaml from "js-yaml";

async function GETp(httpurl, opts) {
  /**
   *  Asynchronous function to perform http query - returns promise that resolves to JSON or rejects an error
   *
   *  opts is an object modifying the request
   *  start, end  range required
   *  noCache   true to ignore cache
   **/
  if (typeof httpurl !== 'string') httpurl = httpurl.href;    // Assume it is a URL as no way to use "instanceof" on URL across node/browser
  const headers = new Headers();
  if (opts.start || opts.end) headers.append('range', `bytes=${opts.start || 0}-${(opts.end < Infinity) ? opts.end : ''}`);
  // if (opts.noCache) headers.append("Cache-Control", "no-cache"); It complains about preflight with no-cache
  //UNSUPPORTED const retries = typeof opts.retries === 'undefined' ? 12 : opts.retries;
  const init = {    // https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch
    method: 'GET',
    headers,
    mode: 'cors',
    cache: opts.noCache ? 'no-cache' : 'default', // In Chrome, This will set Cache-Control: max-age=0
    redirect: 'follow',   // Chrome defaults to manual
    keepalive: true,      // Keep alive - mostly we'll be going back to same places a lot
  };
  const req = new Request(httpurl, init);
  const response = await fetch(req);
  if (!response.ok) {
    throw new Error(`${httpurl} ${response.status}: ${response.statusText}`);
  } else if (response.headers.get('Content-Type').startsWith('text/yaml')) {
    return response.body; // Let caller handle it
  } else if (!response.headers.get('Content-Type').startsWith('application/json')) {
    throw new Error(`Query for ${httpurl} Did not return JSON`);
  } else {
    return response.json(); // Promise resolving to json
  }
}

function GET(httpurl, opts, cb) {
  /**
   * Fetch a URL and cb(err, json)
   */
  GETp(httpurl, opts)
    .then((json) => cb(null, json))
    .catch((err) => {
      cb(err); // Tell queue done with an error
    });
}
function toBool(value) {
  // The "" may or may not be correct, when used as a webcomponent  <foo-bar discover> will pass a value of "", unclear if there is any existing example where empty string is presumed false
  return ["true", "TRUE", 1, "1", "1.0", true, ""].includes(value);
}
// Used to apply different rules to boolean properties
// Note form.autocomplete is text "on" or "off"  translate is yes/no
let booleanAttributes = ['autofocus','autoplay','checked','contenteditable','controls','default',
  'defer','disabled','draggable','hidden','indeterminate','inert','loop','multiple','muted',
  'novalidate','open','readonly','required','selected','spellcheck']
// Standardish routing to allow nesting Elements inside JS
function EL(tag, attributes = {}, children) {
  /**
   * Simplify element creation
   * tag: String for the tag e.g. "FORM"
   * attributes: object setting attributes, properties and state of the tag (state typically used for extensions)
   * children: Elements inside this tag
   */
  const el = document.createElement(tag);
  Object.entries(attributes)
    .forEach((kv) => {
      if (['textContent', 'onsubmit', 'onclick', 'onchange', 'innerHTML', 'style', 'action'].includes(kv[0])) {
        el[kv[0]] = kv[1];
      } else if (booleanAttributes.includes(kv[0])) {
        el[kv[0]] = toBool(kv[1]);  // Booleans are set as fields of the element
      } else if ((typeof kv[1] === 'object') && (kv[1] !== null)) {
        el.attributeChangedCallback(kv[0], null, kv[1]); // will do a state change, but can be subclassed like other attributes
        // el.state[kv[0]] = kv[1]; // e.g tagcloud, data
      } else if (typeof kv[1] === 'function') {
        if (typeof el.state === 'undefined') el.state = {};
        // Experimental e.g. passing function on parent to daughter
        el.state[kv[0]] = kv[1];
      } else if ((kv[1] !== null) && (typeof kv[1] !== 'undefined'))  {
        // Do not set attributes to null or undefined, they will end up as 'null' or 'undefined'
        el.setAttribute(kv[0], kv[1]);
      }
    });
  let k = children;
  if (k) {
    if (typeof k[Symbol.iterator] === 'function') {
      k = Array.from(k);
    }
    if (Array.isArray(k)) {
      el.append(...k.flat(3).filter((n) => !!n));
    } else {
      el.append(k);
    }
  }
  return el;
}

function getUrl(domain, q) {
  /*
   * Get a suitable URL for a query passed as an object
   * domain: String containing domain part of URL e.g. "http://mitra.biz/foo"
   * query: Object containing parameters for query part of url.
   *  Will strip out nulls
   */
  // noinspection JSCheckFunctionSignatures
  const query = Object.entries(q)
    .filter((kv) => ((kv[1] != null) && (typeof kv[1] !== 'undefined')))
    .map((kv) => `${kv[0]}=${encodeURIComponent(kv[1])}`)
    .join('&');
  return query.length ? `${domain}?${query}` : domain;
}

class HTMLElementExtended extends HTMLElement {
  /*
    Parent class for extending HTMLElement for a new element, usually an element will extend this instead of HTMLElement
   */
  /*
  constructor() - sets state, pulls variables from URL, or storage, binds functions etc.
  static get integerAttributes - return array of integer attributes, typically overridden in subclasses
  static get floatAttributes - return array of integer attributes, typically overridden in subclasses
  static get observedAttributes - return array of names of attributes (just strings) passed
  loadSetRenderAndReplace(url, q, cb) - fetch URL, set state from data, render new version
  changeAttribute(name, newValue) - set attributes on state{}, typically converts strings to numbers or bools etc
  setState(obj) - loop over obj calling changeAttribute
  bool get isLoaded - true if data is loaded, can override if put retrieved content some other than this.state.data
  bool shouldLoadWhenConnected() - test if have sufficient state to load data for the element.
  connectedCallback - called when attached to DOM, sets state{}; maybe load data; and renders
  attributeChangedCallback(name, oldValue, newValue) - called when attributes change or added; set state{}; maybe load data; render
  loadContent() - fetch data from server
  renderAndReplace() - render, and then replace existing nodes
  loadAttributesFromURL - set attributes using parameters of URL
  [EL] render() - render an array of nodes  ALWAYS subclassed
  */
  // extend this to set up initial data, e.g. to get params from URL; or to bind functions (e.g. tick)
  constructor() {
    super();
    // console.log(this.localName, "Constructor START"); // uncomment for debugging
    this.attachShadow({ mode: 'open' });
    // Could just create this.state, but dealing with bug report - see note in EL() where
    this.state = {}; // Equivalent of React .state, store local state here
  }

  // Overridden to add new integer attributes
  static get integerAttributes() { return []; }
  // Overridden to add new float attributes
  static get floatAttributes() { return []; }
  // Overridden to add new boolean attributes
  static get boolAttributes() { return []; }
  // Override this to return an array of (string) attributes passed
  static get observedAttributes() { return []; }

  // Called to load a URL, set state based on the data returned, render and then call the callback,
  // it should not need subclassing and is usually called by subclasses of loadContent
  loadSetRenderAndReplace(url, q, cb) {
    // console.log(this.localName, 'loadSetRenderAndReplace'); // uncomment for debugging
    GET(getUrl(url, q), {}, (err, data) => {
      this.setState({ url, err, data });
      this.renderAndReplace();
      if (cb) cb(err); // Usually there is no extra CB
    });
  }

  // changeAttribute will be called for each attribute changed,
  // its most common use is to turn string values into data and is subclassed to do so.
  // This is called by attributeChangedCallback so new values end up in attributes (as strings) and in state (as bools, numbers etc)
  changeAttribute(name, newValue) {
    if (this.constructor.integerAttributes.includes(name)) {
      newValue = parseInt(newValue);
    } // Fine if value is already an int
    if (this.constructor.floatAttributes.includes(name)) {
      newValue = parseFloat(newValue);
    } // Fine if value is already an int
    if (this.constructor.boolAttributes.includes(name)) {
      newValue = toBool(newValue);
    }
    //if ((name === 'visible') && (newValue === 'false')) newValue = false; // Old way before had boolAttributes on anything using "visible"
    this.state[name] = newValue;
  }
  // Loop through all the object returned from a query and set state,
  // typically not subclassed (subclass changeAttribute instead)
  setState(obj) {
    Object.keys(obj).forEach((k) => this.changeAttribute(k, obj[k]));
    // Never calling loadContent() from here as setState is called from loadContent!
  }
  // This function typically indicates we have enough information to initiate what might be a slow load process (e.g. fetch from net)
  // Overridden with a test specific to the required parameters of a webcomponent
  shouldLoadWhenConnected() { return false; }

  // True if its loaded, and often will not render until loaded
  // Subclass if there is other data indicating loaded
  get isLoaded() { return !!this.state.data; }

  //Called when the element is connected into the DOM - copy attributes to state; maybe load content; and render
  //https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#using_the_lifecycle_callbacks
  //This should not need subclassing, more likely to subclass functions it calls.
  connectedCallback() {
    // console.log(this.localName, "Connected"); // uncomment for debugging
    if (this.shouldLoadWhenConnected()) this.loadContent();
    // Note this render is done before loadContent complete, loadContent typically will call renderAndReplace again
    // renderAndReplace should test if it wants to render an empty element if there is no data
    // Note that some users of this library are preferring a connectedCallback that doesn't renderAndReplace and uses 'slot' etc
    this.renderAndReplace();
  }
  // Called whenever an attribute is added or changed,
  // https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements#using_the_lifecycle_callbacks
  // unlikely to be subclassed
  attributeChangedCallback(name, oldValue, newValue) {
    // console.log(this.localName, 'Attribute Changed', name); // uncomment for debugging
    this.changeAttribute(name, newValue); // Sets state{} may also munge value (e.g. string to boolean)
    // reconsider if now have sufficient data to load content
    if (this.isConnected && this.constructor.observedAttributes.includes(name) && this.shouldLoadWhenConnected()) {
      this.loadContent(); }
    // note this render happens before the loadContent completes
    this.renderAndReplace();
  }
  // subclass this to call server side and fetch data
  loadContent() {
    console.error('loadContent should be defined in a subclass if shouldLoadWhenConnected ever returns true');
  }
  // render() a new set of nodes, then remove existing ones and add new ones
  // render0 is intentionally undefined - its absence means try a render, its presence means only render once.
  renderAndReplace() {
    // console.log(this.localName, 'RenderAndReplace', this.isLoaded);
    if (!this.render0) {
      const rendered = this.render();
      while (this.shadowRoot.childNodes.length > 0) this.shadowRoot.childNodes[0].remove();
      /* Flatten render (not sure why at depth=3), eliminate any undefined */
      this.shadowRoot.append(...[rendered].flat(3).filter((n) => !!n));
    } else if (!this.state.rendered) {
      this.state.rendered = true;
      const rendered = this.render0();
      this.shadowRoot.append(...[rendered].flat(3).filter((n) => !!n));
    }
  }

  // Load attributes from URL instead of HTML,
  // typically this is done in the top level switch,
  // for example in CategoryListOrItem on mitra.biz
  // Set observedAttributes to desired attributes from URL
  // Call loadAttributesFromURL() from within the constructor at the end, so at same place in LifeCycle as if in HTML i.e. before connected.
  // However this is only compatible with something loaded from HTML, not from EL TODO figure out why
  // for usage with EL add a method connectedCallback() { this.loadAttributesFromURL(); super.connectedCallback();}
  loadAttributesFromURL() {
    const sp = new URL(window.location.href).searchParams;
    this.constructor.observedAttributes
      .forEach((name) => {
        // Note this sets attribute to string.
        const value = sp.get(name);
        if (value !== null) { // It is not in the URL, so do not set it
          this.setAttribute(name, sp.get(name));
          // setAttribute inside constructor does not call AttributeChanged
          // so need explicit changeAttribute,
          // That is good, as do not want extra call to renderAndReplace that is called from AttributeChanged
          // this may munge attribute before setting state
          // Note this was recently changed for Simulator from being outside the (value !== null) suspect if this causes problems
          this.changeAttribute(name, value); // Dont use getAttribute as forces null to 'null'
        }
      });
  }
  // render an error message instead of the standard render - subclassable
  renderError(err) {
    return (EL('div', { class: 'error' }, [`Error on ${this.state.url}`, EL('br'), err.message]));
  }
  // render a loading message instead of the standard render - subclassable
  renderLoading() {
    return EL('span', { textContent: 'Loading...' });
  }
  // This is gradually deprecating render() in subclasses which do a load,
  // Those should subclass renderLoaded and optionally renderLoading or renderError
  render() {
    return (
      this.state.err ? this.renderError(this.state.err)
        : this.isLoaded ? this.renderLoaded()
          : this.renderLoading());
  }
  // renderLoaded - intentionally undefined, must be defined in subclass, or deprecated render()
}

//TODO should probably remove from classList in an disconnectedCallback (support in HTMLElementExtended) see CategoryListOrItem.renderAndReplace
//TODO I thought GETp and GET probably will not be used outside here - but appear to be...
export { GETp, GET, EL, getUrl, HTMLElementExtended, toBool }; // ErrorLoadingWrapper removed
