import { Controller } from "@hotwired/stimulus"

// Re-focuses and clears the input after a Turbo form submission,
// so the user can keep typing without clicking back into the field.
export default class extends Controller {
  static targets = ["input"]

  connect() {
    this.element.addEventListener("turbo:submit-end", () => {
      this.inputTarget.value = ""
      this.inputTarget.focus()
    })
  }
}
