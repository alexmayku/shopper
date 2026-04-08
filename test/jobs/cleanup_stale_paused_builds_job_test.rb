require "test_helper"

class CleanupStalePausedBuildsJobTest < ActiveJob::TestCase
  setup { @user = users(:alice) }

  test "cancels paused_verification builds older than the threshold" do
    stale = @user.basket_builds.create!(list_snapshot: [], status: :paused_verification)
    stale.update_columns(updated_at: 1.hour.ago)

    fresh = @user.basket_builds.create!(list_snapshot: [], status: :paused_verification)
    other = @user.basket_builds.create!(list_snapshot: [], status: :building)
    other.update_columns(updated_at: 1.hour.ago)

    CleanupStalePausedBuildsJob.perform_now

    assert_equal "cancelled", stale.reload.status
    assert_equal "verification timeout", stale.error_message
    assert_equal "paused_verification", fresh.reload.status
    assert_equal "building", other.reload.status
  end
end
