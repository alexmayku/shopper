import { Controller } from "@hotwired/stimulus"

// Shows a small "Add to Home Screen" banner once the user has shown engagement
// (≥3 list items) AND the browser has fired beforeinstallprompt. Dismissal is
// remembered in localStorage so we don't pester them.
export default class extends Controller {
  static values = { itemCount: Number, threshold: { type: Number, default: 3 } }

  connect() {
    if (this.dismissed) return
    this.deferredPrompt = null
    this._handler = (e) => {
      e.preventDefault()
      this.deferredPrompt = e
      this.maybeShow()
    }
    window.addEventListener("beforeinstallprompt", this._handler)
    this.maybeShow()
  }

  disconnect() {
    window.removeEventListener("beforeinstallprompt", this._handler)
  }

  maybeShow() {
    if (!this.deferredPrompt) return
    if (this.itemCountValue < this.thresholdValue) return
    this.element.classList.remove("hidden")
  }

  async install() {
    if (!this.deferredPrompt) return this.dismiss()
    this.deferredPrompt.prompt()
    await this.deferredPrompt.userChoice
    this.deferredPrompt = null
    this.dismiss()
  }

  dismiss() {
    localStorage.setItem("kart:install_dismissed", "1")
    this.element.classList.add("hidden")
  }

  get dismissed() {
    return localStorage.getItem("kart:install_dismissed") === "1"
  }
}
