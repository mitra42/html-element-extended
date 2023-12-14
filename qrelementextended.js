// noinspection JSPotentiallyInvalidConstructorUsage

import {EL, HTMLElementExtended} from "./htmlelementextended.js";
// TODO presumes qtcode-generator-es6 installed as peer, should probably peel this off
// TODO as seperate repo that requires html-element-extended and qrcode-generator-es6
import qrcode from "../qrcode-generator-es6/index.js";

/* ---- QR Scanner component ---------------
  <qr-scanner onfound="(msg) => console.log('found QR',msg)></qr-scanner>  //TODO-NEXT test
  OR if using htmlelementextended
  EL('qrscan-extended', {onfound: (msg) => console.log('found QR', msg)}) //TODO-NEXT test

  // Or to display a QR code
  <qrcode-extended text="Have a nice day"></common-qrcode>


  https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector/detect - but needs image from camera
  see also https://www.dynamsoft.com/codepool/web-qr-code-scanner-barcode-detection-api.html
  see also https://github.com/xulihang/barcode-detection-api-demo/blob/main/scanner.js
  see also https://dev.to/ycmjason/detecting-barcode-from-the-browser-d7n
  see also https://www.npmjs.com/package/@undecaf/barcode-detector-polyfill I'm following this example
*/
const QRScannerStyle = `div.wrap {width: 320px; height: 240px; border: 2px grey solid; padding: 2px; margin: 2px}`; // Define any styles for this element
class QRScanExtended extends HTMLElementExtended {
  // TODO allow style to be passed in as a parameter to overwrite QRScannerStyle
  constructor() {
    super();
    this.boundtick = this.tick.bind(this);
  } // default does nothing
  static get observedAttributes() { return []; }

  canvas_drawLine(start, end) {
    let context = this.context;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.lineWidth = 5;
    context.strokeStyle = 'white';
    context.stroke();
  }
  canvas_drawLine3(start, end) {
    let p1 = { x: start.x + (end.x - start.x)/4, y: start.y + (end.y - start.y)/4 };
    let p2 = { x: start.x + (end.x - start.x)*3/4, y: start.y + (end.y - start.y)*3/4};
    this.canvas_drawLine(start, p1);
    this.canvas_drawLine(p2, end);
  }
  canvas_drawSquare(cornerPoints) {
    this.canvas_drawLine3(cornerPoints[0], cornerPoints[1]);
    this.canvas_drawLine3(cornerPoints[1], cornerPoints[2]);
    this.canvas_drawLine3(cornerPoints[2], cornerPoints[3]);
    this.canvas_drawLine3(cornerPoints[3], cornerPoints[0]);
  }
  message(msg, err) {
    if (msg) {
      // console.log(msg);
      if (err) console.error(err);
      this.loadingMessage.innerText = msg;
      this.loadingMessage.hidden = false;
    } else {
      this.loadingMessage.hidden = true;
    }
  }
  tick() {
    // Names correspond to old code TODO-NEXT refactor to use the new names in the rest of this code
    let loadingMessage = this.loadingMessage;
    let video = this.video;
    let canvasElement = this.canvas;
    let outputData = this.outputData;
    // END Names corresponding to old code
    this.message("⌛ Loading video...");
    let boundtick = this.boundtick; // Have to find it here. where "this" is still defined
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      this.message();
      canvasElement.hidden = false;
      //Use the height defined in the canvas element
      //canvasElement.height = video.videoHeight;
      //canvasElement.width = video.videoWidth;
      this.context.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
      //Example pulls imageData, but BarcodeDetector can use canvasElement
      //var imageData = this.context.getImageData(0, 0, canvasElement.width, canvasElement.height);
      //TODO-NEXT move BarcodeDetector to module - see node_modules/@undecaf/barcode-detector-polyfill/README.md
      BarcodeDetector.getSupportedFormats()
        .then((supportedFormats) => {
          //let detector = new BarcodeDetector({ formats: ['aztec','data_matrix','qr_code'] });
          //Polyfill currently doesnt support aztec or data_matrix QRcodes, just qr_code
          let formats = ['aztec','data_matrix','qr_code'].filter(s => supportedFormats.includes(s));
          let detector = new BarcodeDetector({ formats });
          detector.detect(canvasElement)
            .catch((err) =>
              this.message('Barcode detect error', err))
            .then((barcodes, unusedErr) => {
              if (barcodes.length > 0) {
                const qr = barcodes[0]; // Ignore after first found
                this.canvas_drawSquare(qr.cornerPoints);
                this.message(qr.rawValue); // Display result  TODO parameterize whether this gets shown or not
                this.result = qr.rawValue; // Allow value to be found passively
                if (this.state.onfound) this.state.onfound(qr.rawValue);
                // Intentionally not going back for a new frame
              } else {
                requestAnimationFrame(boundtick);
              }
            });
        });
      // Following example in
    } else {
      requestAnimationFrame(boundtick);
    }
  }
  wire_camera_to_video_and_tick() {
    // Wire the camera to the video
    let video = this.video;
    let boundtick = this.boundtick; // Have to find it here. where "this" is still defined
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(function(stream) {
        video.srcObject = stream;
        video.setAttribute("playsinline", true); // required to tell iOS safari we don't want fullscreen
        // Next line gets a play() request interrupted by a new load request - says uncaught
        video.play().then(
          () => requestAnimationFrame(boundtick),
          (err) => this.message(err)
        );
      });
  }
  render() {
    //this.canvas = EL("canvas", {id: 'canvas', width: '640', height: '480'});
    this.canvas = EL("canvas", {id: 'canvas', width: '320', height: '240'});
    this.video = EL("video", {width: '320', height: '240'}); // Not displayed
    this.context = this.canvas.getContext("2d", {willReadFrequently: true});
    this.loadingMessage = EL('div'); // We might pass loadingMessage in as a parameter
    this.outputData = EL('div');
    this.wire_camera_to_video_and_tick();
    return ( [
      EL('style', {textContent: QRScannerStyle}), // Using styles defined above
      EL("div", {class: 'wrap'}, [
        this.canvas,
        this.loadingMessage,
        this.outputData,
      ]),
    ]);
  }

}
customElements.define('qrscan-extended', QRScanExtended);


class QRCodeExtended extends HTMLElementExtended {
  // constructor() { super(); } // Default calls super
  // TODO allow style to be passed in as a parameter - note currently not styled here, and may not be styleable by parent
  static get observedAttributes() { return ['text']; }; // Tell it what parms to load - note these are string parms, not objects which are handled differently
  render() {
    const qr = new qrcode('0','H');
    const text =  this.getAttribute('text');
    qr.addData(text);
    qr.make();
    const div = EL('div')
    div.innerHTML = qr.createSvgTag({});
    // TODO Note will probably want to apply style either to svg (especially size) or to div and return div
    return [ div.firstChild ];
  }
}
customElements.define('qrcode-extended', QRCodeExtended); // Pass it to browser, note it MUST be xxx-yyy

export {QRScanExtended, QRCodeExtended}
