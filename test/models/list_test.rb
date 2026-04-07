require "test_helper"

class ListTest < ActiveSupport::TestCase
  test "auto-generates share_token on create" do
    list = List.create!(owner: users(:alice).tap { |u| u.list&.destroy })
    assert list.share_token.present?
    assert list.share_token.length >= 20
  end

  test "rotate_share_token! changes the token" do
    list = lists(:alice_list)
    old = list.share_token
    list.rotate_share_token!
    assert_not_equal old, list.reload.share_token
  end

  test "belongs to owner User" do
    assert_equal users(:alice), lists(:alice_list).owner
  end

  test "has many list_items" do
    assert_equal 2, lists(:alice_list).list_items.count
  end
end
