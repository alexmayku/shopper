class ProductMatch < ApplicationRecord
  belongs_to :user

  validates :freeform_text, presence: true,
                            uniqueness: { scope: :user_id }
  validates :tesco_product_id, presence: true
  validates :tesco_product_name, presence: true

  def self.cached_for(user, freeform)
    find_by(user_id: user.id, freeform_text: freeform)
  end
end
