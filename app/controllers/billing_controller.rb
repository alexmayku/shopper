class BillingController < ApplicationController
  before_action :require_authentication

  def show
    @subscription = current_user.subscription
  end

  def checkout
    plan = params[:plan].to_s
    plan = "monthly" unless %w[monthly annual].include?(plan)
    session = StripeCheckout.create_session(
      user: current_user,
      plan: plan,
      success_url: billing_url,
      cancel_url: billing_url,
    )
    redirect_to session.url, allow_other_host: true, status: :see_other
  rescue Stripe::StripeError => e
    redirect_to billing_path, alert: "Stripe error: #{e.message}", status: :see_other
  end

  def portal
    session = StripeCheckout.create_portal_session(
      user: current_user,
      return_url: billing_url,
    )
    redirect_to session.url, allow_other_host: true
  rescue ArgumentError, Stripe::StripeError => e
    redirect_to billing_path, alert: "Manage billing unavailable: #{e.message}"
  end
end
