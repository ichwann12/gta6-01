// Keyboard and mouse state, polled once per frame. `justPressed` holds the keys
// that went down since the last poll, so a tap of E or P fires exactly once.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.canvas = canvas;
    this.attach();
  }

  attach() {
    const onKey = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (e.type === 'keydown' && !this.keys.has(key)) this.pressed.add(key);
      if (e.type === 'keydown') this.keys.add(key);
      else this.keys.delete(key);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * this.canvas.width;
      this.mouse.y = ((e.clientY - r.top) / r.height) * this.canvas.height;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      }
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(key) {
    return this.keys.has(key);
  }

  justPressed(key) {
    return this.pressed.has(key);
  }

  /** Movement axis from WASD or the arrow keys: {x, y} each in -1..1. */
  moveAxis() {
    const x = (this.down('d') || this.down('ArrowRight') ? 1 : 0) - (this.down('a') || this.down('ArrowLeft') ? 1 : 0);
    const y = (this.down('s') || this.down('ArrowDown') ? 1 : 0) - (this.down('w') || this.down('ArrowUp') ? 1 : 0);
    return { x, y };
  }

  /** Clear the edge-triggered state after each frame. */
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}
