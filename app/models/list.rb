class List < ApplicationRecord
  belongs_to :owner, class_name: "User", foreign_key: :owner_user_id
  has_many :list_items, dependent: :destroy
  has_many :collaborator_sessions, dependent: :destroy

  validates :name, presence: true
  validates :share_token, presence: true, uniqueness: true

  before_validation :ensure_share_token, on: :create

  def rotate_share_token!
    update!(share_token: self.class.generate_share_token)
  end

  def self.generate_share_token
    SecureRandom.urlsafe_base64(24)
  end

  private

  def ensure_share_token
    self.share_token ||= self.class.generate_share_token
  end
end
