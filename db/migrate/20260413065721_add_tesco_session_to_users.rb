class AddTescoSessionToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :tesco_session_state, :text
    add_column :users, :tesco_session_saved_at, :datetime
  end
end
