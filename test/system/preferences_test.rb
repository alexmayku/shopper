require "application_system_test_case"

class PreferencesTest < ApplicationSystemTestCase
  test "user can change price range and toggle organic" do
    visit new_registration_path
    fill_in "user_email", with: "prefs@example.com"
    fill_in "user_password", with: "password123"
    fill_in "user_password_confirmation", with: "password123"
    click_on "Sign up"
    assert_current_path list_path

    visit edit_preferences_path
    assert_text "Tesco sign-in"

    find("label", text: "Premium").click
    page.execute_script("document.getElementById('user_organic_preference').checked = true")

    click_on "Save preferences"

    assert_text "Preferences saved."

    user = User.find_by!(email: "prefs@example.com")
    assert_equal "premium", user.price_range
    assert user.organic_preference
  end
end
