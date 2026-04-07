class CreateLists < ActiveRecord::Migration[8.1]
  def change
    create_table :lists do |t|
      t.references :owner_user, null: false, foreign_key: { to_table: :users }, index: { unique: true }
      t.string :name, null: false, default: "Shopping"
      t.string :share_token, null: false

      t.timestamps
    end

    add_index :lists, :share_token, unique: true
  end
end
