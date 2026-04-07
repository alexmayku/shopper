class User < ApplicationRecord
  has_secure_password

  encrypts :tesco_email
  encrypts :tesco_password

  enum :subscription_status, {
    none: 0,
    trialing: 1,
    active: 2,
    past_due: 3,
    cancelled: 4
  }, default: :none, prefix: true

  enum :price_range, {
    budget: 0,
    mid: 1,
    premium: 2
  }, default: :mid

  has_one :list, foreign_key: :owner_user_id, dependent: :destroy
  has_one :subscription, dependent: :destroy
  has_many :basket_builds, dependent: :destroy
  has_many :product_matches, dependent: :destroy

  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
end
