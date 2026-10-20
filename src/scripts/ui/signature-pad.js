/** A canvas where the user draws a signature with mouse, touch or pen. */
export class SignaturePad {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{onDrawStart?: () => void}} [options]
   */
  constructor(canvas, { onDrawStart = () => {} } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.isDrawing = false;
    this.hasDrawing = false;
    this.onDrawStart = onDrawStart;
    this.bindPointerEvents();
  }

  bindPointerEvents() {
    this.canvas.addEventListener('pointerdown', (event) => {
      this.onDrawStart();
      this.isDrawing = true;
      this.canvas.setPointerCapture(event.pointerId);
      this.context.beginPath();
      this.context.moveTo(...this.pointerPosition(event));
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.isDrawing) return;
      const mouseButtonReleased = event.pointerType === 'mouse' && !(event.buttons & 1);
      if (mouseButtonReleased) {
        this.isDrawing = false;
        return;
      }
      this.context.lineTo(...this.pointerPosition(event));
      this.context.stroke();
      this.hasDrawing = true;
    });

    ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'].forEach((eventName) => {
      this.canvas.addEventListener(eventName, () => {
        this.isDrawing = false;
      });
    });
  }

  pointerPosition(event) {
    const bounds = this.canvas.getBoundingClientRect();
    return [event.clientX - bounds.left, event.clientY - bounds.top];
  }

  /** Matches the drawing surface to the displayed size and erases everything. */
  clear() {
    this.isDrawing = false;
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.width) {
      this.canvas.width = bounds.width;
      this.canvas.height = bounds.height;
      this.context.lineWidth = 2;
      this.context.lineCap = 'round';
      this.context.strokeStyle = '#111';
    }
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.hasDrawing = false;
  }

  toDataUrl() {
    return this.canvas.toDataURL();
  }
}
