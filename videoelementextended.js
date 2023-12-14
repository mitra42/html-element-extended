import { EL, HTMLElementExtended } from './htmlelementextended.js';
//TODO this presumes webtorrent is installed as a peer, that may not be true, ideally
//TODO should split videoelementextended to its own repo that requires webtorrent and html-element-extended
import WebTorrent from '../webtorrent/dist/webtorrent.min.js';
//import WebTorrent from 'https://esm.sh/webtorrent'; // Should work - and get dependencies but does not

/*
  This collection of video components is intended to allow a common syntax for embedding videos.

  This component can take a variety of forms to display different sources of video. Currently supported are...
  <content-video src="https://youtube.com/watch?v=xxxxx"></content-video>
  <content-video torrent="A1B2C3" file="aa/bb.mp4"></content-video>
  <content-video archiveitem="Banana" file="doco.mp4"></content-video>
  <content-video src="https://foo.com/bar.mp4"></content-video>

  TODO add support for archive parameter
  NOTE - to work with webtorrent requires a copy of sw.min.js from node_modules/webtorrent/dist/sw.min.js as has to be served from root level

  Other sources of video may be added later
 */

class YouTubeVideo extends HTMLElementExtended {
// constructor() { super(); }
  static get observedAttributes() { return ['src']; }
  //shouldLoadWhenConnected() { return false; }
  //loadContent() { this.renderAndReplace(); }
  videoid() {
    // Canonicalize any of a variety of URLs into one standard https://youtube.com/abcdef12345
    // TODO-rss canonicalize in sql an content.yaml so rss converter can be simpler
    return this.state.src.replace(/^http(s)?:\/\/(www.)?(youtube.com|youtu.be)\/(v\/)?(watch\?v=)?([a-zA-Z0-9-_]+).*$/, '$6');
  }
  iframesrc() { // Return src converted how YouTube wants it
    return `https://www.youtube.com/embed/${this.videoid()}`;
  }
  /* Note youTube keeps changing what is required, as of 2023-09-05 their embeds look like ...
  <iframe width="560" height="315" src="https://www.youtube.com/embed/Tpozw1CAxmU?si=N25QcimlOtp6dg8g"
  title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media;
   gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
   */
  render() { // Note this has to match transformation in Main.js of content-video for RSS and ATOM
    /* //YouTube broke this at some point - was failing Dec2022
        return EL('object', { width: "100%", height: "100%" }, [
          EL('param', { name: "movie", value: this.state.src }),
          EL('param', { name: "allowFullScreen", value: "true" }),
          EL('param', { name: "allowscriptaccess", value: "always" }),
            ]);
         */
    return EL('iframe', {
        width: '100%', height: '100%',
        src: this.iframesrc(),
        frameBorder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowFullScreen: true,
      },
      []);
  }
}
customElements.define('youtube-video', YouTubeVideo);

class VimeoVideo extends HTMLElementExtended {
// constructor() { super(); }
  static get observedAttributes() { return ['src']; }
  //shouldLoadWhenConnected() { return false; }
  //loadContent() { this.renderAndReplace(); }
  videoid() {
    // Extract id from variety of URLs: https://vimeo.com/5282859 is only one seen so far
    // If add formats, then better to canonicalize in sql and content.yaml so rss converter can be simpler
    return this.state.src.replace(/^http(s)?:\/\/(www.)?vimeo.com\/([0-9]+)$/, '$3');
  }
  render() { // TODO Note this has to match transformation in Main.js of content-video for RSS and ATOM
    // <iframe width="100%" height="550" src="https://player.vimeo.com/video/403530213" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen=""></iframe>
    return EL('iframe', {
        width: '100%', height: '100%',
        src: `https://player.vimeo.com/video/${this.videoid()}`,
        frameBorder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowFullScreen: true,
      },
      []);
  }
}
customElements.define('vimeo-video', VimeoVideo);

class ArchiveVideo extends HTMLElementExtended { // Examples id=2828 Mosh2
// constructor() { super(); }
  static get observedAttributes() { return ['item', 'file']; }
  //shouldLoadWhenConnected() { return false; }
  //loadContent() { this.renderAndReplace(); }
  render() { // Note this has to match transformation in sqllib.js of content-video for RSS and ATOM
    // <iframe src="https://archive.org/embed/Mosh2" width="640" height="480" frameBorder="0" webkitallowfullscreen="true" mozallowfullscreen="true" allowFullScreen></iframe>
    /*
        return EL('iframe', {
          src: this.state.src,
          width: "100%",
          height: "100%",
          frameBorder: "0",
          webkitallowfullscreen: "true",
          mozallowfullscreen: "true",
          allowFullScreen: "true"
        });
        */
    const itemUrl = `https://www-dweb-cors.dev.archive.org/download/${this.state.item}`;
    return EL('webtorrent-video', { torrent: `${itemUrl}/${this.state.item}_archive.torrent`, file: this.state.file, poster: `${itemUrl}/__ia_thumb.jpg` });
  }
}
customElements.define('archive-video', ArchiveVideo);

let WTclient;
const wtDebugStyle = `
span {font-size: x-small; vertical-align: top}
`;

function prettyPrint(n) {
  return (n > 1000000) ? (Math.round(n / 1000000) + 'M')
    : (n > 1000) ? (Math.round(n / 1000) + 'K')
      : Math.round(n);
}

/* WebTorrent can be hard to debug so WebTorrentDebug is defined to provide more information about what is happening */
class WebTorrentDebug extends HTMLElementExtended {
  //constructor() { super(); }
  static get observedAttributes() { return ['torrent']; } // Rerender when wttorrent set
  shouldLoadWhenConnected() { return !!this.state.wtTorrent; }
  loadContent() { } // By default, does nothing

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name === 'torrent' && newValue) {
      WTclient.get(newValue).then((torr) => {
        this.state.wtTorrent = torr;
        if (!this.state.wtTorrent) console.error("Didn't find torrent passed into debug");
        this.state.wtTorrent.on('download', (unusedbytes) => {
          this.renderAndReplace();
        }); // Rerender each time download called
      });
      /* WT1.x.x
      this.state.wtTorrent = WTclient.get(newValue);  // TODO-WT this is a Promise in 3.0
      if (!this.state.wtTorrent) console.error("Didn't find torrent passed into debug");
      this.state.wtTorrent.on('download', (unusedbytes) => {
        this.renderAndReplace();
      }); // Rerender each time download called
       */
    }
  }
  renderPeer(p) {
    return [
      EL('style', { textContent: wtDebugStyle }), // May need mitrabiz.css but should not
      EL('span', { class: 'peer' }, [
        EL('span', { textContent: p.type + ' ' }),
        EL('span', { textContent: p.wire && prettyPrint(p.wire.downloaded) }),
        EL('span', { textContent: 'B ' }), //TODO pretty print
        EL('span', { textContent: p.wire && prettyPrint(p.wire.downloadSpeed()) }),
        EL('span', { textContent: 'B/s ' }), //TODO pretty print
      ]),
    ];
  }
  render() {
    return !this.shouldLoadWhenConnected()
      ? EL('span', { textContent: 'Connecting' })
      : EL('div', {}, [
        EL('span', { textContent: this.state.wtTorrent.numPeers }),
        EL('span', { textContent: ' Peers ' }),
        EL('span', { },
          Object.values(this.state.wtTorrent._peers).map((peer) => this.renderPeer(peer))),
      ]);
  }
}
customElements.define('webtorrent-debug', WebTorrentDebug);

const wtVideoStyle = `
div {width: 100%; height: 100%}
video {width: 95%; height: 95%}
`;
class WebTorrentVideo extends HTMLElementExtended { // id=3058 uptake socap; TODO TEST id=2907 SNL Gore;
  // See https://github.com/webtorrent/webtorrent/blob/master/docs/api.md
  constructor() {
    super();
    //this.state.WTwires = [];
    this.state.WTtorrent = null;
    console.log("XXX WT-constructor");
  }
  // torrent can be a magnet link, or a URL to the torrent file, file can be a file name, or a path in the torrent
  static get observedAttributes() { return ['torrent', 'file', 'poster']; }

  // Only load if we have torrent and file
  shouldLoadWhenConnected() {
    const torrentId = this.state.torrent;
    console.log("XXX shouldLoad = ", (torrentId && this.state.file && (!WTclient || !WTclient.torrentsAdded.includes(torrentId))));
    //return (torrentId && this.state.file && !WTclient.get(torrentId) && !WTclient.torrentsAdded.includes(torrentId));
    // Webtorrent3 has turned WTclient.get into async promise, while this is sync
    return (torrentId && this.state.file && (!WTclient || !WTclient.torrentsAdded.includes(torrentId)));
  }

  changeAttribute(name, newValue) {
    // Allow for torrent values like "/videos/foo.torrent" which WebTorrent does not like naked
    if (name === 'torrent') {
      newValue = (!newValue ? undefined
        : newValue.startsWith('/') ? document.location.origin + newValue
          : newValue);
    }
    super.changeAttribute(name, newValue);
  }

  loadContentAddTorrent() {
    console.log("XXX loadContentAddTorrent");
    const self = this;
    const torrentId = this.state.torrent;
    // TODO will need a way to add a 2nd file, when a torrent is already added but probably not for videos
    WTclient.torrentsAdded.push(torrentId); // Make sure do not add duplicate - this happens with URLs as do not know infohash till retrieved
    const fileWanted = this.state.file; // cos this not available in function
    //console.log("Adding ",this.state.torrent)
    console.log('My peerid is ', WTclient.peerId);
    WTclient.add(torrentId, (torrent) => {
      //console.log('Client has metadata for:', torrent.infoHash)
      // Deselect all files, only select the ones we want to look at see https://github.com/webtorrent/webtorrent/issues/164 for alternates
      // TODO should only deselect all if this is the first time we've added the torrent, so should prior to WT.add
      self.state.WTtorrent = torrent;
      /* Maybe not useful - as seem to get a single wire connection to a webRtc instance */
      torrent.on('wire', (wire) => { // Only way to track peers
        //this.state.WTwires.push(wire);
        console.log('got a wire', wire.peerId, wire);
      });
      torrent.on('download', (bytes) => {
        console.log('Bytes:', bytes, torrent);
      });
      torrent._selections = [];
      torrent.files.forEach((file) => {
        if (file.name === fileWanted || file.path === fileWanted) {
          file.select(); // Download it
          self.state.WTfile = file; // TODO check need this in render
          self.renderAndReplace(); // Have file so can set up to render into it
        }
      });
    });
  }
  loadContent() {
    console.log("XXX loadContent WTclient =",!!WTclient);
    const self = this; // Needed to get "this" into inner functions
    // Lazy initiation as most often will not be using WT but make sure to only run this once as
    // loadContent will be called multiple times
    if (!WTclient) { // Note this looks like a global to me
      WTclient = new WebTorrent();
      WTclient.ready = false;
      WTclient.torrentsAdded = [];

      // TODO-WT once working see if can load from /node_modules/webtorrent/dist/sw.min.js or if
      // this gives problems with scope
      // At worst could special case in main.js to get from webtorrent
      // Note file URLs are of form /webtorrent/<torrentid>/<filename>
      // TODO-WT use something like that URL to recognize in content-video but repl torrentid with torrent's url ?
      //navigator.serviceWorker.register('./sw.min.js', { scope: './' }) // Works, but prefer /node_modules/webtorrent/dist/sw.min.js - TODO-WT make Main serve this
      navigator.serviceWorker.register('/sw.min.js')
      // From top of https://github.com/webtorrent/webtorrent/blob/master/docs/api.md
      // Anticipating problems from asynchronicity
      // TODO Note error checking flags register call above as returning a ignored promise.
      console.log("XXX loadContent checking if ready");
      navigator.serviceWorker.ready.then(
        (controller) => {
          const worker = (controller.active || controller.waiting || controller.installing);
          function createAndLoadIfActivated(worker) {
            console.log("XXX loadContent SW ready worker:", worker.state);
            if (worker.state === "activated") {
              WTclient.createServer({controller})
              WTclient.ready = true;
              self.loadContentAddTorrent();
              return true;
            } else {
              return false;
            }
          }
          if (!createAndLoadIfActivated(worker) ) {
            worker.addEventListener('statechange', ({ target }) => createAndLoadIfActivated(target))
          }
        },
        (error) => console.error(error)
      );
      /*
      const instance = WTclient.createServer()
      instance.server.listen(0);
      WTclient.ready = true;
      self.loadContent();
       */
    } else {
      // Have already created WTclient but might not be ready;
      if (WTclient.ready) {
        this.loadContentAddTorrent();
      }
    }
  }

  render() {
    const el = EL('video', { width: '100%', height: '100%', poster: this.state.poster, controls: true });
    if (this.state.WTfile) {
      //This was how it worked with render-media, but that is not an ESM
      // this.state.WTfile.renderTo(el);
      console.log("Adding file from URL ", this.state.WTfile.streamURL)
      this.state.WTfile.streamTo(el)
    }
    const torrent = this.state.WTtorrent;
    console.log('torrent', torrent);
    return [
      EL('style', { textContent: wtVideoStyle }), // May need mitrabiz.css but should not
      EL('div', { width: '100%', height: '100%' }, [
        el,
        EL('webtorrent-debug', { torrent: torrent ? torrent.infoHash : null }),
      ]),
    ];
  }
}
customElements.define('webtorrent-video', WebTorrentVideo);

const videoStyle = `
div.video{width: 480px; height: 390px}
`;

// TODO expand this in RSS and Atom via code here
class ContentVideo extends HTMLElementExtended {
  // constructor() { super(); }
  static get observedAttributes() { return ['src', 'torrent', 'file', 'archiveitem']; }
  //shouldLoadWhenConnected() { return false; }
  //loadContent() { this.renderAndReplace(); }

  render() { // Note this has to match transformation in Main.js of content-video for RSS and ATOM
    //'<div style="width: 480px; height: 390px"><object width="100%" height="100%"><param name="movie" value="$1"><param name="allowFullScreen" value="true"/><param name="allowscriptaccess" value="always"/></object></div>'
    //'<div style="width: 480px; height: 390px"><video width="100%" height="100%" controls="true"><source src="$1" type="video/mp4"/></video></div>'
    return [
      EL('style', { textContent: videoStyle }), // May need mitrabiz.css but should not
      EL('div', { class: 'video' }, [
        this.state.torrent
          ? EL('webtorrent-video', { torrent: this.state.torrent, file: this.state.file }) // TODO get poster auto
          : this.state.archiveitem
            ? EL('archive-video', { item: this.state.archiveitem, file: this.state.file })
            : this.state.src.includes('youtube')
              ? EL('youtube-video', { src: this.state.src })
              : this.state.src.includes('vimeo')
                ? EL('vimeo-video', { src: this.state.src })
                : EL('video', { width: '100%', height: '100%', controls: true }, [
                  EL('source', { src: this.state.src, type: 'video/mp4' }),
                ]),
      ]),
    ];
  }
}
customElements.define('content-video', ContentVideo);

// eslint-disable-next-line import/prefer-default-export
export { ContentVideo };
