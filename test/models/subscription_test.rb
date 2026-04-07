require "test_helper"

class SubscriptionTest < ActiveSupport::TestCase
  test "active? true for active status" do
    assert subscriptions(:alice_sub).active?
  end

  test "active? true for trialing" do
    sub = subscriptions(:alice_sub)
    sub.update!(status: "trialing")
    assert sub.active?
  end

  test "active? false for past_due" do
    sub = subscriptions(:alice_sub)
    sub.update!(status: "past_due")
    assert_not sub.active?
  end
end
