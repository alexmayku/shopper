require "application_system_test_case"

class PreferencesTest < ApplicationSystemTestCase
  test "user can change price range, toggle organic, and store Tesco credentials" do
    visit new_registration_path
    fill_in "user_email", with: "prefs@example.com"
    fill_in "user_password", with: "password123"
    fill_in "user_password_confirmation", with: "password123"
    click_on "Sign up"
    assert_current_path list_path

    visit edit_preferences_path
    assert_text "Tesco sign-in"
    assert_text "We never see it"

    find("label", text: "Premium").click
    page.execute_script("document.getElementById('user_organic_preference').checked = true")

    fill_in "user_tesco_email", with: "shop@tesco.com"
    fill_in "user_tesco_password", with: "s3cretpass"
    click_on "Save preferences"

    assert_text "Preferences saved."

    user = User.find_by!(email: "prefs@example.com")
    assert_equal "premium", user.price_range
    assert user.organic_preference
    assert_equal "shop@tesco.com", user.tesco_email
    assert_equal "s3cretpass", user.tesco_password
  end
end
