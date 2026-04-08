require "test_helper"

class StripeWebhookHandlerTest < ActiveSupport::TestCase
  setup do
    @user = users(:alice)
    @user.subscription&.destroy
    @user.reload
  end

  def event(type, object)
    { "type" => type, "data" => { "object" => object.deep_stringify_keys } }
  end

  test "checkout.session.completed sets stripe_customer_id" do
    e = event("checkout.session.completed", { client_reference_id: @user.id.to_s, customer: "cus_new" })
    StripeWebhookHandler.handle(e)
    assert_equal "cus_new", @user.reload.stripe_customer_id
  end

  test "subscription.created creates a Subscription and syncs user.subscription_status" do
    @user.update!(stripe_customer_id: "cus_a")
    e = event("customer.subscription.created", {
      id: "sub_1", customer: "cus_a", status: "active", current_period_end: 1.month.from_now.to_i
    })
    assert_difference "Subscription.count", 1 do
      StripeWebhookHandler.handle(e)
    end
    sub = @user.reload.subscription
    assert_equal "sub_1", sub.stripe_subscription_id
    assert_equal "active", sub.status
    assert sub.current_period_end > Time.current
    assert_equal "active", @user.subscription_status
  end

  test "subscription.updated upserts (idempotent)" do
    @user.update!(stripe_customer_id: "cus_a")
    e = event("customer.subscription.updated", {
      id: "sub_1", customer: "cus_a", status: "trialing", current_period_end: 1.week.from_now.to_i
    })
    StripeWebhookHandler.handle(e)
    StripeWebhookHandler.handle(e)
    assert_equal 1, @user.reload.subscription.then { |_| Subscription.where(user_id: @user.id).count }
    assert_equal "trialing", @user.subscription.status
    assert_equal "trialing", @user.subscription_status
  end

  test "subscription.deleted cancels locally" do
    @user.update!(stripe_customer_id: "cus_a")
    @user.create_subscription!(stripe_subscription_id: "sub_1", status: "active", current_period_end: 1.day.from_now)
    e = event("customer.subscription.deleted", { id: "sub_1", customer: "cus_a", status: "canceled" })
    StripeWebhookHandler.handle(e)
    assert_equal "canceled", @user.subscription.reload.status
    assert_equal "cancelled", @user.reload.subscription_status
  end

  test "ignores unknown event types" do
    assert_equal :ignored, StripeWebhookHandler.handle(event("invoice.created", {}))
  end

  test "no-op when no user matches the customer id" do
    e = event("customer.subscription.created", { id: "sub_x", customer: "cus_unknown", status: "active", current_period_end: 0 })
    assert_nothing_raised { StripeWebhookHandler.handle(e) }
  end
end
