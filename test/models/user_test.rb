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

  test "has_secure_password authenticates" do
    u = User.create!(email: "auth@example.com", password: "password123")
    assert u.authenticate("password123")
    assert_not u.authenticate("wrong")
  end

  test "encrypts tesco credentials round-trip" do
    u = User.create!(email: "t@example.com", password: "password123",
                     tesco_email: "shopper@tesco.com", tesco_password: "secret!")
    u.reload
    assert_equal "shopper@tesco.com", u.tesco_email
    assert_equal "secret!", u.tesco_password
    raw = User.connection.select_value("SELECT tesco_password FROM users WHERE id = #{u.id}")
    assert_not_equal "secret!", raw
  end

  test "subscription_status enum default none" do
    assert_equal "none", User.new.subscription_status
  end

  test "price_range enum default mid" do
    assert_equal "mid", User.new.price_range
  end
end
