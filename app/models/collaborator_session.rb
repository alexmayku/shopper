class CollaboratorSession < ApplicationRecord
  belongs_to :list

  validates :session_id, presence: true,
                         uniqueness: { scope: :list_id }
end
