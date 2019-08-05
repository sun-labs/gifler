// Generated by CoffeeScript 1.10.0
var Animator, Decoder, Gif, GifReader, Promise, gifler,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

GifReader = require('omggif').GifReader;

Promise = require('bluebird');


/*---
head : 'gifler()'
text :
  - This is the main entrypoint to the library.
  - Prepares and sends an XHR request to load the GIF file.
  - Returns a <b>Gif</b> instance for interacting with the library.
args : 
  url : 'URL to .gif file'
return : 'a Gif instance object'
 */

gifler = function(url) {
  var aync, promise, xhr;
  xhr = new XMLHttpRequest();
  xhr.open('GET', url, aync = true);
  xhr.responseType = 'arraybuffer';
  promise = new Promise(function(resolve, reject) {
    return xhr.onload = function(e) {
      return resolve(this.response);
    };
  });
  xhr.send();
  return new Gif(promise);
};

Gif = (function() {
  Gif.getCanvasElement = function(selector) {
    var element, ref;
    if (typeof selector === 'string' && ((ref = (element = document.querySelector(selector))) != null ? ref.tagName : void 0) === 'CANVAS') {
      return element;
    } else if ((selector != null ? selector.tagName : void 0) === 'CANVAS') {
      return selector;
    } else {
      throw new Error('Unexpected selector type. Valid types are query-selector-string/canvas-element');
    }
  };

  function Gif(dataPromise) {
    this._animatorPromise = dataPromise.then(function(data) {
      var reader;
      reader = new GifReader(new Uint8Array(data));
      return Decoder.decodeFramesAsync(reader).then(function(frames) {
        return new Animator(reader, frames);
      });
    });
  }


  /*---
  head : 'gif.animate()'
  text :
    - >
      Animates the loaded GIF, drawing each frame into the canvas.
      This matches the look of an &lt;img&gt; tag.
  args : 
    selector : 'A <canvas> element or query selector for a <canvas> element.'
   */

  Gif.prototype.animate = function(selector) {
    var canvas;
    canvas = Gif.getCanvasElement(selector);
    return this._animatorPromise.then(function(animator) {
      return animator.animateInCanvas(canvas);
    });
  };


  /*---
  head : 'gif.frames()'
  text :
    - >
      Runs the animation on the loaded GIF, but passes the
      canvas context and GIF frame to the <b>onDrawFrame</b>
      callback for rendering.
    - >
      This gives you complete control of how the frame is drawn
      into the canvas context.
  args : 
    selector     : 'A <canvas> element or query selector for a <canvas> element.'
    onDrawFrame  : 'A callback that will be invoked when each frame should be drawn into the canvas. see Animator.onDrawFrame.'
    setDimesions : 'OPTIONAL. If true, the canvas''s width/height will be set to the dimension of the loaded GIF. default: false.'
   */

  Gif.prototype.frames = function(selector, onDrawFrame, setCanvasDimesions) {
    var canvas;
    if (setCanvasDimesions == null) {
      setCanvasDimesions = false;
    }
    canvas = Gif.getCanvasElement(selector);
    return this._animatorPromise.then(function(animator) {
      animator.onDrawFrame = onDrawFrame;
      return animator.animateInCanvas(canvas, setCanvasDimesions);
    });
  };


  /*---
  head : 'gif.get()'
  text :
    - >
      To get even more control, and for your convenience,
      this method returns a promise that will be fulfilled with
      an <b>Animator</b> instance. The animator will be in an unstarted state,
      but can be started with a call to <b>animator.animateInCanvas()</b>
   */

  Gif.prototype.get = function(callback) {
    return this._animatorPromise;
  };

  return Gif;

})();


/*
These methods decode the pixels for each frame (decompressing and de-interlacing)
into a Uint8ClampedArray, which is suitable for canvas ImageData.
 */

Decoder = (function() {
  function Decoder() {}

  Decoder.decodeFramesSync = function(reader) {
    var j, ref, results;
    return (function() {
      results = [];
      for (var j = 0, ref = reader.numFrames(); 0 <= ref ? j < ref : j > ref; 0 <= ref ? j++ : j--){ results.push(j); }
      return results;
    }).apply(this).map(function(frameIndex) {
      return Decoder.decodeFrame(reader, frameIndex);
    });
  };

  Decoder.decodeFramesAsync = function(reader) {
    var concurrency, j, ref, results;
    return Promise.map((function() {
      results = [];
      for (var j = 0, ref = reader.numFrames(); 0 <= ref ? j < ref : j > ref; 0 <= ref ? j++ : j--){ results.push(j); }
      return results;
    }).apply(this), (function(i) {
      return Decoder.decodeFrame(reader, i);
    }), concurrency = 1);
  };

  Decoder.decodeFrame = function(reader, frameIndex) {
    var frameInfo;
    frameInfo = reader.frameInfo(frameIndex);
    frameInfo.pixels = new Uint8ClampedArray(reader.width * reader.height * 4);
    reader.decodeAndBlitFrameRGBA(frameIndex, frameInfo.pixels);
    return frameInfo;
  };

  return Decoder;

})();

Animator = (function() {

  /*---
  head : 'animator::createBufferCanvas()'
  text :
    - >
      Creates a buffer canvas element since it is much faster
      to call <b>.putImage()</b> than <b>.putImageData()</b>.
    - >
      The omggif library decodes the pixels into the full gif
      dimensions. We only need to store the frame dimensions,
      so we offset the putImageData call.
  args :
    frame  : A frame of the GIF (from the omggif library)
    width  : width of the GIF (not the frame)
    height : height of the GIF
  return : A <canvas> element containing the frame's image.
   */
  Animator.createBufferCanvas = function(frame, width, height) {
    var bufferCanvas, bufferContext, imageData;
    bufferCanvas = document.createElement('canvas');
    bufferContext = bufferCanvas.getContext('2d');
    bufferCanvas.width = frame.width;
    bufferCanvas.height = frame.height;
    imageData = bufferContext.createImageData(width, height);
    imageData.data.set(frame.pixels);
    bufferContext.putImageData(imageData, -frame.x, -frame.y);
    return bufferCanvas;
  };

  function Animator(_reader, _frames) {
    var ref;
    this._reader = _reader;
    this._frames = _frames;
    this._advanceFrame = bind(this._advanceFrame, this);
    this._nextFrameRender = bind(this._nextFrameRender, this);
    this._nextFrame = bind(this._nextFrame, this);
    ref = this._reader, this.width = ref.width, this.height = ref.height;
    this._loopCount = this._reader.loopCount();
    this._loops = 0;
    this._frameIndex = 0;
    this._running = false;
  }


  /*---
  head : 'animator.start()'
  text :
    - Starts running the GIF animation loop.
   */

  Animator.prototype.start = function() {
    this._lastTime = new Date().valueOf();
    this._delayCompensation = 0;
    this._running = true;
    setTimeout(this._nextFrame, 0);
    return this;
  };


  /*---
  head : 'animator.stop()'
  text :
    - Stops running the GIF animation loop.
   */

  Animator.prototype.stop = function() {
    this._running = false;
    return this;
  };


  /*---
  head : 'animator.reset()'
  text :
    - Resets the animation loop to the first frame.
    - Does not stop the animation from running.
   */

  Animator.prototype.reset = function() {
    this._frameIndex = 0;
    this._loops = 0;
    return this;
  };


  /*---
  head : 'animator.running()'
  return : A boolean indicating whether or not the animation is running.
   */

  Animator.prototype.running = function() {
    return this._running;
  };

  Animator.prototype._nextFrame = function() {
    requestAnimationFrame(this._nextFrameRender);
  };

  Animator.prototype._nextFrameRender = function() {
    var frame, ref;
    if (!this._running) {
      return;
    }
    frame = this._frames[this._frameIndex];
    if ((ref = this.onFrame) != null) {
      ref.apply(this, [frame, this._frameIndex]);
    }
    return this._enqueueNextFrame();
  };

  Animator.prototype._advanceFrame = function() {
    this._frameIndex += 1;
    if (this._frameIndex >= this._frames.length) {
      if (this._loopCount !== 0 && this._loopCount === this._loops) {
        this.stop();
      } else {
        this._frameIndex = 0;
        this._loops += 1;
      }
    }
  };

  Animator.prototype._enqueueNextFrame = function() {
    var actualDelay, delta, frame, frameDelay;
    this._advanceFrame();
    while (this._running) {
      frame = this._frames[this._frameIndex];
      delta = new Date().valueOf() - this._lastTime;
      this._lastTime += delta;
      this._delayCompensation += delta;
      frameDelay = frame.delay * 10;
      actualDelay = frameDelay - this._delayCompensation;
      this._delayCompensation -= frameDelay;
      if (actualDelay < 0) {
        this._advanceFrame();
        continue;
      } else {
        setTimeout(this._nextFrame, actualDelay);
        break;
      }
    }
  };


  /*---
  head : 'animator.animateInCanvas()'
  text :
    - >
      This method prepares the canvas to be drawn into and sets up
      the callbacks for each frame while the animation is running.
    - >
      To change how each frame is drawn into the canvas, override
      <b>animator.onDrawFrame()</b> before calling this method.
      If <b>animator.onDrawFrame()</b> is not set, we simply draw
      the frame directly into the canvas as is.
    - >
      You may also override <b>animator.onFrame()</b> before calling
      this method. onFrame handles the lazy construction of canvas
      buffers for each frame as well as the disposal method for each frame.
  args :
    canvas        : A canvas element.
    setDimensions : 'OPTIONAL. If true, the canvas width/height will be set to match the GIF. default: true.'
   */

  Animator.prototype.animateInCanvas = function(canvas, setDimensions) {
    var ctx;
    if (setDimensions == null) {
      setDimensions = true;
    }
    if (setDimensions) {
      canvas.width = this.width;
      canvas.height = this.height;
    }
    ctx = canvas.getContext('2d');
    if (this.onDrawFrame == null) {
      this.onDrawFrame = function(ctx, frame, i) {
        return ctx.drawImage(frame.buffer, frame.x, frame.y);
      };
    }
    if (this.onFrame == null) {
      this.onFrame = (function(_this) {
        return function(frame, i) {
          var ref, saved;
          if (frame.buffer == null) {
            frame.buffer = Animator.createBufferCanvas(frame, _this.width, _this.height);
          }
          if (typeof _this.disposeFrame === "function") {
            _this.disposeFrame();
          }
          switch (frame.disposal) {
            case 2:
              _this.disposeFrame = function() {
                return ctx.clearRect(0, 0, canvas.width, canvas.height);
              };
              break;
            case 3:
              saved = ctx.getImageData(0, 0, canvas.width, canvas.height);
              _this.disposeFrame = function() {
                return ctx.putImageData(saved, 0, 0);
              };
              break;
            default:
              _this.disposeFrame = null;
          }
          return (ref = _this.onDrawFrame) != null ? ref.apply(_this, [ctx, frame, i]) : void 0;
        };
      })(this);
    }
    this.start();
    return this;
  };

  return Animator;

})();

gifler.Gif = Gif;

gifler.Decoder = Decoder;

gifler.Animator = Animator;

export default gifler;
