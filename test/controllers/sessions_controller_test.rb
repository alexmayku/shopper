require "test_helper"

class SessionsControllerTest < ActionDispatch::IntegrationTest
  setup { @user = users(:alice) }

  test "new" do
    get new_session_path
    assert_response :success
  end

  test "create with valid credentials redirects to /list" do
    post session_path, params: { email: @user.email, password: "password123" }
    assert_redirected_to list_path
    assert cookies[:session_id]
  end

  test "create with invalid credentials" do
    post session_path, params: { email: @user.email, password: "wrong" }
    assert_redirected_to new_session_path
    assert_nil cookies[:session_id].presence
  end

  test "destroy" do
    sign_in_as(@user)
    delete session_path
    assert_redirected_to new_session_path
    assert_empty cookies[:session_id]
  end
end
