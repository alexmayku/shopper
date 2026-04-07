require "application_system_test_case"

class RealtimeSyncTest < ApplicationSystemTestCase
  test "items added in one session appear in another within 2 seconds" do
    Capybara.using_session("owner_a") do
      visit new_registration_path
      fill_in "user_email", with: "sync@example.com"
      fill_in "user_password", with: "password123"
      fill_in "user_password_confirmation", with: "password123"
      click_on "Sign up"
      assert_current_path list_path
    end

    Capybara.using_session("owner_b") do
      visit new_session_path
      fill_in "email", with: "sync@example.com"
      fill_in "password", with: "password123"
      click_on "Sign in"
      assert_current_path list_path
      assert_text "Add your first item"
    end

    Capybara.using_session("owner_a") do
      fill_in "list_item_freeform_text", with: "milk"
      click_on "Add"
      assert_text "milk"
    end

    Capybara.using_session("owner_b") do
      assert_text "milk", wait: 3
    end
  end
end
