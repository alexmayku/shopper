import { Controller } from "@hotwired/stimulus"

// Auto-focuses the input when the controller connects (after Turbo
// page navigations) so the user can keep typing without clicking.
export default class extends Controller {
  static targets = ["input"]

  connect() {
    this.inputTarget.focus()
  }
}
