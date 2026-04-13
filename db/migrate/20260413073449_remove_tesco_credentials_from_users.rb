class RemoveTescoCredentialsFromUsers < ActiveRecord::Migration[8.1]
  def change
    remove_column :users, :tesco_email, :string
    remove_column :users, :tesco_password, :string
  end
end
