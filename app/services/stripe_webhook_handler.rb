class StripeWebhookHandler
  HANDLED_EVENTS = %w[
    customer.subscription.created
    customer.subscription.updated
    customer.subscription.deleted
    checkout.session.completed
  ].freeze

  def self.handle(event)
    new.handle(event)
  end

  def handle(event)
    return :ignored unless HANDLED_EVENTS.include?(event["type"])

    case event["type"]
    when "checkout.session.completed"
      apply_checkout_completed(event["data"]["object"])
    when "customer.subscription.created", "customer.subscription.updated"
      upsert_subscription(event["data"]["object"])
    when "customer.subscription.deleted"
      mark_cancelled(event["data"]["object"])
    end
    :ok
  end

  private

  def apply_checkout_completed(session)
    user = User.find_by(id: session["client_reference_id"])
    return unless user
    user.update!(stripe_customer_id: session["customer"]) if session["customer"].present?
  end

  def upsert_subscription(stripe_sub)
    user = User.find_by(stripe_customer_id: stripe_sub["customer"])
    return unless user

    sub = user.subscription || user.build_subscription
    sub.stripe_subscription_id = stripe_sub["id"]
    sub.status = stripe_sub["status"]
    sub.current_period_end = epoch_to_time(stripe_sub["current_period_end"])
    sub.save!

    user.update!(subscription_status: map_status(stripe_sub["status"]))
  end

  def mark_cancelled(stripe_sub)
    user = User.find_by(stripe_customer_id: stripe_sub["customer"])
    return unless user
    sub = user.subscription
    sub&.update!(status: "canceled")
    user.update!(subscription_status: :cancelled)
  end

  def map_status(stripe_status)
    case stripe_status
    when "active"             then :active
    when "trialing"           then :trialing
    when "past_due", "unpaid" then :past_due
    when "canceled", "incomplete_expired" then :cancelled
    else :none
    end
  end

  def epoch_to_time(ts)
    return nil unless ts
    Time.zone.at(ts)
  end
end
