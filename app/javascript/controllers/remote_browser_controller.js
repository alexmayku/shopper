import { Controller } from "@hotwired/stimulus"

// Renders a remote browser session streamed via WebSocket.
// Receives JPEG frames (binary), draws them to a canvas.
// Forwards mouse clicks and keyboard events to the server.
export default class extends Controller {
  static targets = ["canvas", "status"]
  static values = {
    wsUrl: String,      // WebSocket URL for the screencast stream
    loginId: String,    // Login session ID (for complete/cancel actions)
  }

  connect() {
    this.ctx = this.canvasTarget.getContext("2d")
    this.connected = false
    this.startWebSocket()
    this.canvasTarget.setAttribute("tabindex", "0")
    this.canvasTarget.focus()
  }

  disconnect() {
    if (this.ws) this.ws.close()
  }

  startWebSocket() {
    this.setStatus("Connecting...")
    this.ws = new WebSocket(this.wsUrlValue)
    this.ws.binaryType = "arraybuffer"

    this.ws.onopen = () => {
      this.connected = true
      this.setStatus("Connected")
      this.bindInputEvents()
    }

    this.ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.drawFrame(event.data)
      }
    }

    this.ws.onclose = () => {
      this.connected = false
      this.setStatus("Disconnected")
    }

    this.ws.onerror = () => {
      this.setStatus("Connection error")
    }
  }

  drawFrame(buffer) {
    const blob = new Blob([buffer], { type: "image/jpeg" })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      // Resize canvas to match the frame dimensions on first frame.
      if (this.canvasTarget.width !== img.width || this.canvasTarget.height !== img.height) {
        this.canvasTarget.width = img.width
        this.canvasTarget.height = img.height
      }
      this.ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  bindInputEvents() {
    // Mouse clicks — translate canvas coordinates to browser viewport.
    this.canvasTarget.addEventListener("click", (e) => {
      const rect = this.canvasTarget.getBoundingClientRect()
      const scaleX = this.canvasTarget.width / rect.width
      const scaleY = this.canvasTarget.height / rect.height
      const x = Math.round((e.clientX - rect.left) * scaleX)
      const y = Math.round((e.clientY - rect.top) * scaleY)
      this.sendInput({ type: "click", x, y })
    })

    // Keyboard events — forward to the remote browser.
    this.canvasTarget.addEventListener("keydown", (e) => {
      e.preventDefault()
      this.sendInput({ type: "keydown", key: e.key, code: e.code })
    })

    // Scroll events.
    this.canvasTarget.addEventListener("wheel", (e) => {
      e.preventDefault()
      const rect = this.canvasTarget.getBoundingClientRect()
      const scaleX = this.canvasTarget.width / rect.width
      const scaleY = this.canvasTarget.height / rect.height
      const x = Math.round((e.clientX - rect.left) * scaleX)
      const y = Math.round((e.clientY - rect.top) * scaleY)
      this.sendInput({ type: "scroll", x, y, deltaX: e.deltaX, deltaY: e.deltaY })
    }, { passive: false })
  }

  sendInput(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  setStatus(text) {
    if (this.hasStatusTarget) {
      this.statusTarget.textContent = text
    }
  }
}
