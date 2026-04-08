class Webhooks::StripeController < ApplicationController
  allow_unauthenticated_access
  skip_forgery_protection

  def create
    payload   = request.raw_post
    signature = request.headers["Stripe-Signature"]
    secret    = ENV["STRIPE_WEBHOOK_SECRET"].presence ||
                Rails.application.credentials.dig(:stripe, :webhook_secret)

    event =
      begin
        Stripe::Webhook.construct_event(payload, signature, secret)
      rescue JSON::ParserError, Stripe::SignatureVerificationError
        return head :bad_request
      end

    StripeWebhookHandler.handle(event.to_hash.deep_stringify_keys)
    head :ok
  end
end
