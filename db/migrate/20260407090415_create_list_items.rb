class CreateListItems < ActiveRecord::Migration[8.1]
  def change
    create_table :list_items do |t|
      t.references :list, null: false, foreign_key: true
      t.string :freeform_text, null: false
      t.integer :quantity, null: false, default: 1
      t.integer :position, null: false
      t.references :added_by_user, foreign_key: { to_table: :users }
      t.string :added_by_session_id

      t.timestamps
    end
  end
end
