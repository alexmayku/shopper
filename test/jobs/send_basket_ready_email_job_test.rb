require "test_helper"

class SendBasketReadyEmailJobTest < ActiveJob::TestCase
  include ActionMailer::TestHelper
  setup do
    @user = users(:alice)
    @build = @user.basket_builds.create!(
      list_snapshot: [{ freeform: "milk", quantity: 1 }],
      status: :ready,
      total_pence: 1234,
    )
  end

  test "delivers a BasketMailer.ready email" do
    assert_emails 1 do
      SendBasketReadyEmailJob.perform_now(@build.id)
    end
    mail = ActionMailer::Base.deliveries.last
    assert_equal "Your Tesco basket is ready.", mail.subject
  end
end
