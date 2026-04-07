require "test_helper"

class RegistrationsControllerTest < ActionDispatch::IntegrationTest
  test "new renders" do
    get new_registration_path
    assert_response :success
  end

  test "create with valid params signs in and redirects to /list" do
    assert_difference "User.count", 1 do
      post registration_path, params: {
        user: { email: "fresh@example.com", password: "password123", password_confirmation: "password123" }
      }
    end
    assert_redirected_to list_path
    assert cookies[:session_id]
  end

  test "create with duplicate email fails" do
    assert_no_difference "User.count" do
      post registration_path, params: {
        user: { email: users(:alice).email, password: "password123", password_confirmation: "password123" }
      }
    end
    assert_response :unprocessable_entity
  end

  test "create with mismatched password confirmation fails" do
    assert_no_difference "User.count" do
      post registration_path, params: {
        user: { email: "x@example.com", password: "password123", password_confirmation: "different" }
      }
    end
    assert_response :unprocessable_entity
  end

  test "create with short password fails" do
    assert_no_difference "User.count" do
      post registration_path, params: {
        user: { email: "y@example.com", password: "short", password_confirmation: "short" }
      }
    end
    assert_response :unprocessable_entity
  end
end
