* HTML ELEMENT EXTENDED

This goal of this project is to
create a simple wrapper for web components that provides
much of the useful functionality of lifecycle frameworks like react
without the complication or overhead.

In particular there is no compile-time step for this library,
each of the files can be loaded as a module. 

To use this, (currently, until its on npmjs.com)
To a caller add to `package.json/dependencies`
```
"html-element-extended": "https://github.com/mitra42/html-element-extended",
```
Then in your webcomponents.js file for example include it with
```
import { EL, HTMLElementExtended, getUrl } from './node_modules/html-element-extended/htmlelementextended.js';
```
To add a new module,
* Add a file here xxxelementextended.js
* Add to the docs here
* Add to package.json/exports

Each module is documented internally but as a TL;DR

** htmlelementextended.js

Provides HTMLElementExtended which can be used instead of HTMLElement
to create your own web components, but has the key functionality already there.

Note - all of these are under development. 
If you use them please introduce yourself in a git issue, 
and I'll bear this in mind when making any breaking revisions. 

** eventbus.js
A simple event handler to hide the mechanisms

* At the page level create e.g. `const bus = new EventBus`
* At a receiving object typically   bus.register("foo",(evt) => {...})
* At sending end bus.fire("foo",{a: 1, b: 2})
* remove is rarely used, but is there for completeness.
