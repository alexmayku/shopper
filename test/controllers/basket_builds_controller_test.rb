require "test_helper"

class BasketBuildsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:alice)
    @user.update!(tesco_email: "shop@tesco.com", tesco_password: "secret")
    sign_in_as(@user)
    @captured_sidecar_calls = []
    captured = @captured_sidecar_calls
    SidecarClient.singleton_class.alias_method :_orig_start_build, :start_build
    SidecarClient.define_singleton_method(:start_build) do |build, callback_base_url:|
      captured << [build.id, callback_base_url]
      true
    end
  end

  teardown do
    SidecarClient.singleton_class.alias_method :start_build, :_orig_start_build
    SidecarClient.singleton_class.remove_method :_orig_start_build
  end

  test "create snapshots the list, persists the build, and enqueues the job" do
    assert_difference "BasketBuild.count", 1 do
      post basket_builds_path
    end
    build = BasketBuild.order(:id).last
    assert_equal "matching", build.status
    assert_equal 2, build.list_snapshot.length
    assert_redirected_to basket_build_path(build)
    assert_equal 1, @captured_sidecar_calls.length
    assert_equal build.id, @captured_sidecar_calls.first.first
  end

  test "show renders the build" do
    build = @user.basket_builds.create!(list_snapshot: [], status: :matching)
    get basket_build_path(build)
    assert_response :success
    assert_match "Matching your items", @response.body
  end

  test "show 404s for another user's build" do
    other = users(:bob).basket_builds.create!(list_snapshot: [], status: :matching)
    get basket_build_path(other)
    assert_response :not_found
  end

  test "renders paywall and skips enqueue when trial used and not subscribed" do
    @user.update!(trial_used: true)
    @user.subscription&.destroy

    assert_no_difference "BasketBuild.count" do
      post basket_builds_path
    end
    assert_response :payment_required
    assert_match "Your first basket was on us", @response.body
    assert_empty @captured_sidecar_calls
  end

  test "active subscriber can build even after trial used" do
    @user.update!(trial_used: true)
    sub = @user.subscription || @user.create_subscription!(stripe_subscription_id: "x")
    sub.update!(status: "active")

    assert_difference "BasketBuild.count", 1 do
      post basket_builds_path
    end
    assert_redirected_to basket_build_path(BasketBuild.order(:id).last)
  end

  test "first build is free even without subscription" do
    @user.update!(trial_used: false)
    @user.subscription&.destroy

    assert_difference "BasketBuild.count", 1 do
      post basket_builds_path
    end
    assert_redirected_to basket_build_path(BasketBuild.order(:id).last)
  end

  test "create requires login" do
    delete session_path
    post basket_builds_path
    assert_redirected_to new_session_path
  end
end
