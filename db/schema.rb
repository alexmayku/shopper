# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_04_07_090419) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "basket_builds", force: :cascade do |t|
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.string "error_message"
    t.jsonb "list_snapshot", null: false
    t.jsonb "progress_log", default: [], null: false
    t.integer "status", default: 0, null: false
    t.string "tesco_checkout_url"
    t.integer "total_pence"
    t.jsonb "unmatched_items", default: [], null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["status"], name: "index_basket_builds_on_status"
    t.index ["user_id"], name: "index_basket_builds_on_user_id"
  end

  create_table "collaborator_sessions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "display_name"
    t.datetime "last_seen_at"
    t.bigint "list_id", null: false
    t.string "session_id", null: false
    t.datetime "updated_at", null: false
    t.index ["list_id", "session_id"], name: "index_collaborator_sessions_on_list_id_and_session_id", unique: true
    t.index ["list_id"], name: "index_collaborator_sessions_on_list_id"
  end

  create_table "list_items", force: :cascade do |t|
    t.string "added_by_session_id"
    t.bigint "added_by_user_id"
    t.datetime "created_at", null: false
    t.string "freeform_text", null: false
    t.bigint "list_id", null: false
    t.integer "position", null: false
    t.integer "quantity", default: 1, null: false
    t.datetime "updated_at", null: false
    t.index ["added_by_user_id"], name: "index_list_items_on_added_by_user_id"
    t.index ["list_id"], name: "index_list_items_on_list_id"
  end

  create_table "lists", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name", default: "Shopping", null: false
    t.bigint "owner_user_id", null: false
    t.string "share_token", null: false
    t.datetime "updated_at", null: false
    t.index ["owner_user_id"], name: "index_lists_on_owner_user_id", unique: true
    t.index ["share_token"], name: "index_lists_on_share_token", unique: true
  end

  create_table "product_matches", force: :cascade do |t|
    t.float "confidence"
    t.datetime "created_at", null: false
    t.string "freeform_text", null: false
    t.datetime "last_used_at"
    t.integer "price_pence"
    t.string "tesco_product_id", null: false
    t.string "tesco_product_name", null: false
    t.string "tesco_product_url"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id", "freeform_text"], name: "index_product_matches_on_user_id_and_freeform_text", unique: true
    t.index ["user_id"], name: "index_product_matches_on_user_id"
  end

  create_table "subscriptions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "current_period_end"
    t.string "status"
    t.string "stripe_subscription_id"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["stripe_subscription_id"], name: "index_subscriptions_on_stripe_subscription_id", unique: true
    t.index ["user_id"], name: "index_subscriptions_on_user_id", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.boolean "organic_preference", default: false, null: false
    t.string "password_digest", null: false
    t.integer "price_range", default: 1, null: false
    t.string "stripe_customer_id"
    t.integer "subscription_status", default: 0, null: false
    t.string "tesco_email"
    t.string "tesco_password"
    t.boolean "trial_used", default: false, null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["stripe_customer_id"], name: "index_users_on_stripe_customer_id", unique: true
  end

  add_foreign_key "basket_builds", "users"
  add_foreign_key "collaborator_sessions", "lists"
  add_foreign_key "list_items", "lists"
  add_foreign_key "list_items", "users", column: "added_by_user_id"
  add_foreign_key "lists", "users", column: "owner_user_id"
  add_foreign_key "product_matches", "users"
  add_foreign_key "subscriptions", "users"
end
