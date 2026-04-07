class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :password_digest, null: false
      t.string :stripe_customer_id
      t.integer :subscription_status, null: false, default: 0
      t.boolean :trial_used, null: false, default: false
      t.string :tesco_email
      t.string :tesco_password
      t.integer :price_range, null: false, default: 1
      t.boolean :organic_preference, null: false, default: false

      t.timestamps
    end

    add_index :users, :email, unique: true
    add_index :users, :stripe_customer_id, unique: true
  end
end
