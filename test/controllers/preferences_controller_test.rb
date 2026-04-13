require "test_helper"

class PreferencesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:alice)
    sign_in_as(@user)
  end

  test "edit renders" do
    get edit_preferences_path
    assert_response :success
    assert_match "Tesco sign-in", @response.body
  end

  test "update changes price_range and organic_preference" do
    patch preferences_path, params: { user: { price_range: "premium", organic_preference: "1" } }
    @user.reload
    assert_equal "premium", @user.price_range
    assert @user.organic_preference
  end

  test "update saves price_range and organic_preference" do
    patch preferences_path, params: { user: { price_range: "budget", organic_preference: "0" } }
    @user.reload
    assert_equal "budget", @user.price_range
    assert_not @user.organic_preference
  end

  test "requires login" do
    delete session_path
    get edit_preferences_path
    assert_redirected_to new_session_path
  end
end
