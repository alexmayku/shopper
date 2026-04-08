require "test_helper"

class BuildBasketJobTest < ActiveJob::TestCase
  setup do
    @user = users(:alice)
    @build = @user.basket_builds.create!(
      list_snapshot: [{ freeform: "milk", quantity: 1 }],
      status: :matching,
    )
  end

  def with_stubbed_sidecar(impl)
    SidecarClient.singleton_class.alias_method :_orig_start_build, :start_build
    SidecarClient.define_singleton_method(:start_build, &impl)
    yield
  ensure
    SidecarClient.singleton_class.alias_method :start_build, :_orig_start_build
    SidecarClient.singleton_class.remove_method :_orig_start_build
  end

  test "calls SidecarClient.start_build with the build and callback url" do
    captured = nil
    with_stubbed_sidecar(->(build, callback_base_url:) { captured = [build.id, callback_base_url]; true }) do
      BuildBasketJob.perform_now(@build.id, callback_base_url: "http://app.test")
    end
    assert_equal @build.id, captured.first
    assert_equal "http://app.test", captured.last
  end

  test "marks the build as failed when the sidecar errors out" do
    with_stubbed_sidecar(->(_build, callback_base_url:) { raise SidecarClient::Error, "boom" }) do
      BuildBasketJob.perform_now(@build.id, callback_base_url: "http://app.test")
    end
    assert_equal "failed", @build.reload.status
    assert_equal "boom", @build.error_message
  end
end
