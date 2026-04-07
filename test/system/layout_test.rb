require "application_system_test_case"

class LayoutTest < ApplicationSystemTestCase
  test "signed-out users do not see the header on signup/login pages" do
    visit new_session_path
    assert_no_selector "header"

    visit new_registration_path
    assert_no_selector "header"
  end

  test "signed-in users see the header with account menu" do
    visit new_registration_path
    fill_in "user_email", with: "layout@example.com"
    fill_in "user_password", with: "password123"
    fill_in "user_password_confirmation", with: "password123"
    click_on "Sign up"

    assert_current_path list_path
    assert_selector "header", text: "Kart"
    assert_selector "header", text: "Account"
  end

  test "flash messages render and auto-dismiss" do
    visit new_session_path
    fill_in "email", with: "nope@example.com"
    fill_in "password", with: "wrongpass"
    click_on "Sign in"

    assert_selector "[data-controller='flash']", text: "Try another email or password."
    assert_no_selector "[data-controller='flash']", wait: 5
  end
end
