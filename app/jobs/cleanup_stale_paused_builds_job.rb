class CleanupStalePausedBuildsJob < ApplicationJob
  queue_as :default

  STALE_AFTER = 30.minutes

  def perform
    cutoff = STALE_AFTER.ago
    BasketBuild.where(status: :paused_verification).where("updated_at < ?", cutoff).find_each do |build|
      build.update!(status: :cancelled, error_message: "verification timeout")
      build.append_progress({ "event" => "auto_cancelled_paused_verification", "at" => Time.current.to_s })
    end
  end
end
