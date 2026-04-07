require "test_helper"

class BasketBuildTest < ActiveSupport::TestCase
  test "default status is matching" do
    assert_equal "matching", basket_builds(:alice_build).status
  end

  test "append_progress appends and saves" do
    build = basket_builds(:alice_build)
    build.append_progress({ "event" => "started", "at" => "now" })
    build.append_progress({ "event" => "step", "at" => "later" })
    build.reload
    assert_equal 2, build.progress_log.length
    assert_equal "started", build.progress_log.first["event"]
  end
end
