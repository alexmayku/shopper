class BasketBuild < ApplicationRecord
  belongs_to :user

  enum :status, {
    matching: 0,
    building: 1,
    paused_verification: 2,
    ready: 3,
    failed: 4,
    cancelled: 5,
    paused_existing_basket: 6
  }, default: :matching

  def append_progress(event_hash)
    self.progress_log = (progress_log || []) + [event_hash]
    save!
  end

  def existing_basket_count
    (progress_log || []).reverse.find { |e| e["event"] == "existing_basket_detected" }&.dig("item_count")
  end
end
