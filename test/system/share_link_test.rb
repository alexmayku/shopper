require "application_system_test_case"

class ShareLinkTest < ApplicationSystemTestCase
  test "owner and anonymous collaborator sync via share link" do
    share_token = nil

    Capybara.using_session("owner") do
      visit new_registration_path
      fill_in "user_email", with: "share_owner@example.com"
      fill_in "user_password", with: "password123"
      fill_in "user_password_confirmation", with: "password123"
      click_on "Sign up"
      assert_current_path list_path
      share_token = User.find_by!(email: "share_owner@example.com").list.share_token
    end

    Capybara.using_session("anon") do
      visit "/s/#{share_token}"
      assert_text "collaborator mode"

      fill_in "list_item_freeform_text", with: "anon milk"
      click_on "Add"
      assert_text "anon milk"
    end

    Capybara.using_session("owner") do
      assert_text "anon milk", wait: 3
    end
  end
end
