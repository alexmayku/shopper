class Subscription < ApplicationRecord
  belongs_to :user

  ACTIVE_STATUSES = %w[active trialing].freeze

  def active?
    ACTIVE_STATUSES.include?(status)
  end
end
