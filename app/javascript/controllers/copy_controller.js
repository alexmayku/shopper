import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["source", "label"]

  async copy() {
    try {
      await navigator.clipboard.writeText(this.sourceTarget.value)
    } catch (e) {
      this.sourceTarget.select()
      document.execCommand("copy")
    }
    if (this.hasLabelTarget) {
      const original = this.labelTarget.textContent
      this.labelTarget.textContent = "Copied!"
      setTimeout(() => { this.labelTarget.textContent = original }, 1500)
    }
  }
}
