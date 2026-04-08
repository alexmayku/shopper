require "test_helper"

class Webhooks::StripeControllerTest < ActionDispatch::IntegrationTest
  setup do
    @secret = "whsec_test"
    ENV["STRIPE_WEBHOOK_SECRET"] = @secret

    @captured = []
    captured = @captured
    StripeWebhookHandler.singleton_class.alias_method :_orig_handle, :handle
    StripeWebhookHandler.define_singleton_method(:handle) { |event| captured << event; :ok }
  end

  teardown do
    ENV.delete("STRIPE_WEBHOOK_SECRET")
    StripeWebhookHandler.singleton_class.alias_method :handle, :_orig_handle
    StripeWebhookHandler.singleton_class.remove_method :_orig_handle
  end

  def signed_headers(payload)
    timestamp = Time.now.to_i
    sig = OpenSSL::HMAC.hexdigest("SHA256", @secret, "#{timestamp}.#{payload}")
    { "Stripe-Signature" => "t=#{timestamp},v1=#{sig}", "Content-Type" => "application/json" }
  end

  test "verified payload is dispatched and returns 200" do
    payload = {
      id: "evt_1", type: "customer.subscription.created",
      data: { object: { id: "sub_1", customer: "cus_a", status: "active", current_period_end: 1 } }
    }.to_json
    post "/webhooks/stripe", params: payload, headers: signed_headers(payload)
    assert_response :ok
    assert_equal 1, @captured.length
    assert_equal "customer.subscription.created", @captured.first["type"]
  end

  test "bad signature returns 400 and does not dispatch" do
    payload = '{"id":"evt_x","type":"customer.subscription.created","data":{"object":{}}}'
    post "/webhooks/stripe", params: payload, headers: { "Stripe-Signature" => "t=1,v1=deadbeef", "Content-Type" => "application/json" }
    assert_response :bad_request
    assert_empty @captured
  end
end
