class ListItem < ApplicationRecord
  belongs_to :list
  belongs_to :added_by_user, class_name: "User", optional: true

  validates :freeform_text, presence: true
  validates :quantity, numericality: { only_integer: true, greater_than_or_equal_to: 1 }
  validates :position, presence: true

  default_scope -> { order(:position) }
end
