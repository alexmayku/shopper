require "application_system_test_case"

class AuthenticationTest < ApplicationSystemTestCase
  test "happy path: sign up redirects to /list" do
    visit new_registration_path
    fill_in "user_email", with: "system@example.com"
    fill_in "user_password", with: "password123"
    fill_in "user_password_confirmation", with: "password123"
    click_on "Sign up"

    assert_current_path list_path
    assert_text "Shopping"
  end
end
