require "test_helper"

class BasketMailerTest < ActionMailer::TestCase
  setup do
    @user = users(:alice)
    @build = @user.basket_builds.create!(
      list_snapshot: [{ freeform: "milk", quantity: 1 }],
      status: :ready,
      total_pence: 1234,
      tesco_checkout_url: "http://localhost:4002/checkout/abc",
    )
  end

  test "ready email subject and recipients" do
    mail = BasketMailer.ready(@build)
    assert_equal "Your Tesco basket is ready.", mail.subject
    assert_equal [@user.email], mail.to
  end

  test "ready email body contains a deep link to /builds/:id" do
    mail = BasketMailer.ready(@build)
    assert_match "/builds/#{@build.id}", mail.body.encoded
    assert_match "12.34", mail.body.encoded
  end
end
