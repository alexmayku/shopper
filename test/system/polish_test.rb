require "application_system_test_case"

class PolishTest < ApplicationSystemTestCase
  test "list empty state shows the friendly prompt" do
    visit new_registration_path
    fill_in "user_email", with: "polish@example.com"
    fill_in "user_password", with: "password123"
    fill_in "user_password_confirmation", with: "password123"
    click_on "Sign up"

    assert_text "Add your first item"
    assert_text "Type milk, bread, eggs"
  end

  test "Add to Tesco basket without credentials redirects to preferences with a friendly flash" do
    visit new_registration_path
    fill_in "user_email", with: "no_creds@example.com"
    fill_in "user_password", with: "password123"
    fill_in "user_password_confirmation", with: "password123"
    click_on "Sign up"
    assert_current_path list_path

    fill_in "list_item_freeform_text", with: "milk"
    click_on "Add"
    assert_text "milk"

    click_on "Add to Tesco basket"
    assert_current_path edit_preferences_path
    assert_text "Tesco sign-in"
  end

  test "build failed partial uses the calm copy" do
    user = User.create!(email: "fail@example.com", password: "password123",
                        tesco_email: "x@tesco.com", tesco_password: "x")
    build = user.basket_builds.create!(list_snapshot: [], status: :failed,
                                       error_message: "tesco unreachable")

    sign_in user

    visit basket_build_path(build)
    assert_text "The build hit a snag"
    assert_text "Nothing was left in your Tesco basket"
    assert_no_text "Oops"
  end

  private

  def sign_in(user)
    visit new_session_path
    fill_in "email", with: user.email
    fill_in "password", with: "password123"
    click_on "Sign in"
    assert_current_path list_path
  end
end
