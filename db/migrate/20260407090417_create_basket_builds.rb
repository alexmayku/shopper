class CreateBasketBuilds < ActiveRecord::Migration[8.1]
  def change
    create_table :basket_builds do |t|
      t.references :user, null: false, foreign_key: true
      t.jsonb :list_snapshot, null: false
      t.integer :status, null: false, default: 0
      t.jsonb :progress_log, null: false, default: []
      t.jsonb :unmatched_items, null: false, default: []
      t.string :tesco_checkout_url
      t.integer :total_pence
      t.string :error_message
      t.datetime :completed_at

      t.timestamps
    end

    add_index :basket_builds, :status
  end
end
