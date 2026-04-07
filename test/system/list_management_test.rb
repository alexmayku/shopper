require "application_system_test_case"

class ListManagementTest < ApplicationSystemTestCase
  test "user can add, adjust, delete, and clear items" do
    visit new_registration_path
    fill_in "user_email", with: "lister@example.com"
    fill_in "user_password", with: "password123"
    fill_in "user_password_confirmation", with: "password123"
    click_on "Sign up"

    assert_current_path list_path
    assert_text "Add your first item"

    %w[milk bread eggs].each do |item|
      fill_in "list_item_freeform_text", with: item
      click_on "Add"
      assert_text item
    end

    user = User.find_by!(email: "lister@example.com")
    milk = user.list.list_items.find_by!(freeform_text: "milk")
    bread = user.list.list_items.find_by!(freeform_text: "bread")

    within("##{ActionView::RecordIdentifier.dom_id(milk)}") do
      click_on "+"
    end
    assert_text "2"

    within("##{ActionView::RecordIdentifier.dom_id(bread)}") do
      click_on "✕"
    end
    assert_no_text "bread"

    accept_confirm { click_on "Clear" }
    assert_text "Add your first item"
  end

  test "new user gets a Shopping list automatically" do
    visit new_registration_path
    fill_in "user_email", with: "auto@example.com"
    fill_in "user_password", with: "password123"
    fill_in "user_password_confirmation", with: "password123"
    click_on "Sign up"

    assert_text "Shopping"
  end
end
