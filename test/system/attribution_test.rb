require "application_system_test_case"

class AttributionTest < ApplicationSystemTestCase
  test "owner and anonymous collaborator items show different attribution dot colours" do
    share_token = nil

    Capybara.using_session("owner") do
      visit new_registration_path
      fill_in "user_email", with: "attr_owner@example.com"
      fill_in "user_password", with: "password123"
      fill_in "user_password_confirmation", with: "password123"
      click_on "Sign up"
      assert_current_path list_path

      fill_in "list_item_freeform_text", with: "owner item"
      click_on "Add"
      assert_text "owner item"

      share_token = User.find_by!(email: "attr_owner@example.com").list.share_token
    end

    Capybara.using_session("anon") do
      visit "/s/#{share_token}"
      fill_in "list_item_freeform_text", with: "anon item"
      click_on "Add"
      assert_text "anon item"
    end

    Capybara.using_session("owner") do
      assert_text "anon item", wait: 3
      owner_item = ListItem.find_by!(freeform_text: "owner item")
      anon_item  = ListItem.find_by!(freeform_text: "anon item")

      owner_dot_class = find("##{ActionView::RecordIdentifier.dom_id(owner_item)} .attribution-dot")[:class]
      anon_dot_class  = find("##{ActionView::RecordIdentifier.dom_id(anon_item)} .attribution-dot")[:class]

      assert_includes owner_dot_class, "bg-neutral-900"
      assert_no_match(/bg-neutral-900/, anon_dot_class)
    end
  end
end
