require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "valid user" do
    u = User.new(email: "new@example.com", password: "password123")
    assert u.valid?
  end

  test "requires email" do
    u = User.new(password: "password123")
    assert_not u.valid?
    assert_includes u.errors[:email], "can't be blank"
  end

  test "requires unique email" do
    u = User.new(email: users(:alice).email, password: "password123")
    assert_not u.valid?
  end

  test "requires valid email format" do
    u = User.new(email: "not-an-email", password: "password123")
    assert_not u.valid?
  end

  test "normalizes email (downcase + strip)" do
    u = User.new(email: " UPPER@Example.COM ", password: "password123")
    assert_equal "upper@example.com", u.email
  end

  test "rejects short passwords" do
    u = User.new(email: "x@example.com", password: "short")
    assert_not u.valid?
  end

  test "has_secure_password authenticates" do
    u = User.create!(email: "auth@example.com", password: "password123")
    assert u.authenticate("password123")
    assert_not u.authenticate("wrong")
  end

  test "encrypts tesco session state round-trip" do
    state = '{"cookies":[{"name":"sid","value":"abc"}]}'
    u = User.create!(email: "t@example.com", password: "password123",
                     tesco_session_state: state)
    u.reload
    assert_equal state, u.tesco_session_state
    raw = User.connection.select_value("SELECT tesco_session_state FROM users WHERE id = #{u.id}")
    assert_not_equal state, raw
  end

  test "subscription_status enum default none" do
    assert_equal "none", User.new.subscription_status
  end

  test "price_range enum default mid" do
    assert_equal "mid", User.new.price_range
  end
end
