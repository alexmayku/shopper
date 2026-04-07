class CreateProductMatches < ActiveRecord::Migration[8.1]
  def change
    create_table :product_matches do |t|
      t.references :user, null: false, foreign_key: true
      t.string :freeform_text, null: false
      t.string :tesco_product_id, null: false
      t.string :tesco_product_name, null: false
      t.string :tesco_product_url
      t.integer :price_pence
      t.float :confidence
      t.datetime :last_used_at

      t.timestamps
    end

    add_index :product_matches, [:user_id, :freeform_text], unique: true
  end
end
