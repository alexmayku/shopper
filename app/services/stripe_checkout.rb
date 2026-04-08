class StripeCheckout
  PLAN_TO_ENV = {
    "monthly" => "STRIPE_PRICE_ID_MONTHLY",
    "annual"  => "STRIPE_PRICE_ID_ANNUAL",
  }.freeze

  def self.create_session(user:, plan:, success_url:, cancel_url:)
    new.create_session(user: user, plan: plan, success_url: success_url, cancel_url: cancel_url)
  end

  def self.create_portal_session(user:, return_url:)
    new.create_portal_session(user: user, return_url: return_url)
  end

  def create_session(user:, plan:, success_url:, cancel_url:)
    price_id = ENV[PLAN_TO_ENV.fetch(plan, "STRIPE_PRICE_ID_MONTHLY")]
    Stripe::Checkout::Session.create(
      mode: "subscription",
      customer: user.stripe_customer_id,
      customer_email: user.stripe_customer_id ? nil : user.email,
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: success_url,
      cancel_url: cancel_url,
      client_reference_id: user.id.to_s,
      allow_promotion_codes: true,
    )
  end

  def create_portal_session(user:, return_url:)
    raise ArgumentError, "no stripe_customer_id" if user.stripe_customer_id.blank?
    Stripe::BillingPortal::Session.create(
      customer: user.stripe_customer_id,
      return_url: return_url,
    )
  end
end
