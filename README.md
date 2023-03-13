* HTML ELEMENT EXTENDED

This goal of this project is to
create a simple wrapper for web components that provides
much of the useful functionality of lifecycle frameworks like react
without the complication or overhead.

In particular there is no compile-time step for this library,
each of the files can be loaded as a module. 

I am not 100% sure of best practice for modules, rather than 
node libraries that use require - if there is a better way to do 
organize this please open an issue and I'll do a "major version" revision.

Each module is documented internally but as a TL;DR

** htmlelementextended.js

Provides HTMLElementExtended which can be used instead of HTMLElement
to create your own web components, but has the key functionality already there.

** qrelementextended.js

Use HTMLElementExtended to build a QR scanner and a QR display

** videoelementextended.js

Uses HTMLElementExtended to create a number of video webComponents that 
know how to display videos from a variety of sources (based on the URL)
allowing a single <ContentVideo> component to handle 
YouTube, Vimeo, Internet Archive, WebTorrent etc. 

Note - all of these are under development. 
If you use them please introduce yourself in a git issue 
and I'll bear this in mind when making any breaking revisions. 
