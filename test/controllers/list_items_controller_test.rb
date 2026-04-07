require "test_helper"

class ListItemsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:alice)
    @list = lists(:alice_list)
    sign_in_as(@user)
  end

  test "create appends an item with the next position" do
    assert_difference "@list.list_items.count", 1 do
      post list_items_path, params: { list_item: { freeform_text: "eggs", quantity: 1 } }
    end
    item = @list.list_items.order(:position).last
    assert_equal "eggs", item.freeform_text
    assert_equal @user, item.added_by_user
  end

  test "create rejects blank freeform_text" do
    assert_no_difference "@list.list_items.count" do
      post list_items_path, params: { list_item: { freeform_text: "", quantity: 1 } }
    end
  end

  test "update changes quantity" do
    item = list_items(:milk)
    patch list_item_path(item), params: { list_item: { quantity: 5 } }
    assert_equal 5, item.reload.quantity
  end

  test "update rejects quantity < 1" do
    item = list_items(:milk)
    patch list_item_path(item), params: { list_item: { quantity: 0 } }
    assert_equal 2, item.reload.quantity
  end

  test "destroy removes the item" do
    item = list_items(:milk)
    assert_difference "@list.list_items.count", -1 do
      delete list_item_path(item)
    end
  end

  test "clear removes all items" do
    post clear_list_path
    assert_equal 0, @list.reload.list_items.count
  end

  test "requires login" do
    delete session_path
    post list_items_path, params: { list_item: { freeform_text: "milk" } }
    assert_redirected_to new_session_path
  end
end
