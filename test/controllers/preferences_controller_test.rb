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

  test "update sets tesco credentials, encrypted at rest" do
    patch preferences_path, params: { user: { tesco_email: "shop@tesco.com", tesco_password: "s3cret" } }
    @user.reload
    assert_equal "shop@tesco.com", @user.tesco_email
    assert_equal "s3cret", @user.tesco_password
    raw = User.connection.select_value("SELECT tesco_password FROM users WHERE id = #{@user.id}")
    assert_not_equal "s3cret", raw
  end

  test "clear_tesco_credentials nils both fields" do
    @user.update!(tesco_email: "x@tesco.com", tesco_password: "pw")
    delete clear_tesco_credentials_path
    @user.reload
    assert_nil @user.tesco_email
    assert_nil @user.tesco_password
  end

  test "requires login" do
    delete session_path
    get edit_preferences_path
    assert_redirected_to new_session_path
  end
end
