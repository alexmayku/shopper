module Kart
  PRICES = {
    monthly: { label: "Monthly", price: ENV.fetch("KART_PRICE_MONTHLY", "£4.99/mo") },
    annual:  { label: "Annual",  price: ENV.fetch("KART_PRICE_ANNUAL",  "£39/yr")   },
  }.freeze
end
