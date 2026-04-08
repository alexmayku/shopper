require "test_helper"

class AttributionHelperTest < ActionView::TestCase
  include AttributionHelper

  test "owner attributed items always get OWNER_COLOR" do
    item = ListItem.new(added_by_user_id: 1)
    assert_equal AttributionHelper::OWNER_COLOR, attribution_color_for(item)

    item2 = ListItem.new(added_by_user_id: 999)
    assert_equal AttributionHelper::OWNER_COLOR, attribution_color_for(item2)
  end

  test "anonymous collaborators get a palette color, deterministic per session" do
    item = ListItem.new(added_by_session_id: "session-abc")
    color = attribution_color_for(item)
    assert_includes AttributionHelper::PALETTE, color

    same_again = attribution_color_for(ListItem.new(added_by_session_id: "session-abc"))
    assert_equal color, same_again
  end

  test "different sessions can map to different colours" do
    sessions = (1..40).map { |i| "sess-#{i}" }
    colors = sessions.map { |s| attribution_color_for(ListItem.new(added_by_session_id: s)) }
    assert colors.uniq.length > 1, "expected the palette to spread across sessions"
  end

  test "label says 'you' for the viewer who added the item" do
    user = users(:alice)
    item = ListItem.new(added_by_user_id: user.id)
    assert_equal "Added by you", attribution_label_for(item, viewer: user)
  end

  test "label says 'partner' for a different viewer" do
    item = ListItem.new(added_by_user_id: users(:alice).id)
    assert_equal "Added by partner", attribution_label_for(item, viewer: users(:bob))
  end

  test "label falls back to generic 'collaborator' with no viewer" do
    item = ListItem.new(added_by_session_id: "x")
    assert_equal "Added by collaborator", attribution_label_for(item)
  end
end
