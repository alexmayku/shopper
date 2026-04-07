class BasketBuild < ApplicationRecord
  belongs_to :user

  enum :status, {
    matching: 0,
    building: 1,
    paused_verification: 2,
    ready: 3,
    failed: 4,
    cancelled: 5
  }, default: :matching

  validates :list_snapshot, presence: true

  def append_progress(event_hash)
    self.progress_log = (progress_log || []) + [event_hash]
    save!
  end
end
