module UiHelper
  BUTTON_BASE = "inline-flex items-center justify-center rounded-full text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed".freeze

  BUTTON_VARIANTS = {
    primary:   "bg-neutral-900 text-white hover:bg-neutral-800 px-6 py-4",
    secondary: "border border-neutral-300 text-neutral-900 hover:bg-neutral-100 px-6 py-4",
    tertiary:  "text-neutral-700 hover:text-neutral-900 px-3 py-2"
  }.freeze

  INPUT_CLASSES = "block w-full rounded-2xl border border-neutral-300 bg-white px-4 py-4 text-base placeholder-neutral-400 focus:outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900".freeze

  CARD_CLASSES = "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm".freeze

  def button_classes(variant = :primary, extra: nil)
    [BUTTON_BASE, BUTTON_VARIANTS.fetch(variant), extra].compact.join(" ")
  end

  def input_classes(extra: nil)
    [INPUT_CLASSES, extra].compact.join(" ")
  end

  def card_classes(extra: nil)
    [CARD_CLASSES, extra].compact.join(" ")
  end
end
