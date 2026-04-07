require "test_helper"

class ListItemTest < ActiveSupport::TestCase
  test "valid with required attributes" do
    item = ListItem.new(list: lists(:alice_list), freeform_text: "eggs", quantity: 1, position: 99)
    assert item.valid?
  end

  test "quantity must be >= 1" do
    item = ListItem.new(list: lists(:alice_list), freeform_text: "eggs", quantity: 0, position: 99)
    assert_not item.valid?
  end

  test "default scope orders by position" do
    items = lists(:alice_list).list_items.to_a
    assert_equal items.sort_by(&:position), items
  end

  test "added_by_user is optional" do
    item = ListItem.new(list: lists(:alice_list), freeform_text: "eggs", quantity: 1, position: 99)
    assert item.valid?
  end
end
