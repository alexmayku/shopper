require "test_helper"

class ProductMatchTest < ActiveSupport::TestCase
  test "unique on user_id + freeform_text" do
    dup = ProductMatch.new(user: users(:alice), freeform_text: "milk",
                           tesco_product_id: "x", tesco_product_name: "y")
    assert_not dup.valid?
  end

  test "cached_for returns nil when no match" do
    assert_nil ProductMatch.cached_for(users(:bob), "milk")
  end

  test "cached_for returns the record when cached" do
    assert_equal product_matches(:alice_milk), ProductMatch.cached_for(users(:alice), "milk")
  end
end
