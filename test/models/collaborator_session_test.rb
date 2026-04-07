require "test_helper"

class CollaboratorSessionTest < ActiveSupport::TestCase
  test "unique on list_id + session_id" do
    dup = CollaboratorSession.new(list: lists(:alice_list), session_id: "session_abc")
    assert_not dup.valid?
  end

  test "valid with new session id on same list" do
    fresh = CollaboratorSession.new(list: lists(:alice_list), session_id: "session_xyz")
    assert fresh.valid?
  end
end
