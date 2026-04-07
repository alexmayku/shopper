require "test_helper"

class SharedListsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @list = lists(:alice_list)
  end

  test "anonymous can GET /s/:share_token" do
    get shared_list_path(@list.share_token)
    assert_response :success
    assert_match "collaborator mode", @response.body
  end

  test "anonymous can add an item via shared route" do
    assert_difference "@list.list_items.count", 1 do
      post shared_list_items_path(@list.share_token),
           params: { list_item: { freeform_text: "anon eggs", quantity: 1 } }
    end
    item = @list.list_items.order(:position).last
    assert_equal "anon eggs", item.freeform_text
    assert_nil item.added_by_user_id
    assert item.added_by_session_id.present?
  end

  test "anonymous can update an item via shared route" do
    item = list_items(:milk)
    patch shared_list_item_path(@list.share_token, item),
          params: { list_item: { quantity: 9 } }
    assert_equal 9, item.reload.quantity
  end

  test "anonymous can delete an item via shared route" do
    item = list_items(:milk)
    assert_difference "@list.list_items.count", -1 do
      delete shared_list_item_path(@list.share_token, item)
    end
  end

  test "creates a CollaboratorSession on first visit" do
    assert_difference "@list.collaborator_sessions.count", 1 do
      get shared_list_path(@list.share_token)
    end
  end

  test "404 for unknown share_token" do
    get shared_list_path("nope")
    assert_response :not_found
  end

  test "owner can rotate share_token, old token breaks" do
    sign_in_as(users(:alice))
    old = @list.share_token
    post rotate_share_token_path
    assert_response :see_other
    @list.reload
    assert_not_equal old, @list.share_token

    delete session_path
    get shared_list_path(old)
    assert_response :not_found
  end
end
