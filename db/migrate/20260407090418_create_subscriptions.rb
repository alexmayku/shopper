class CreateSubscriptions < ActiveRecord::Migration[8.1]
  def change
    create_table :subscriptions do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.string :stripe_subscription_id
      t.string :status
      t.datetime :current_period_end

      t.timestamps
    end

    add_index :subscriptions, :stripe_subscription_id, unique: true
  end
end
