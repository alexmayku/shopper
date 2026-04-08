require "test_helper"

class Internal::BasketBuildCallbacksControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user  = users(:alice)
    @build = @user.basket_builds.create!(list_snapshot: [], status: :matching)
    @secret = "test-secret"
    ENV["SIDECAR_HMAC_SECRET"] = @secret
  end

  teardown { ENV.delete("SIDECAR_HMAC_SECRET") }

  def sig(body)
    OpenSSL::HMAC.hexdigest("SHA256", @secret, body)
  end

  test "progress appends an event to the build" do
    body = { event: "added", freeform: "milk" }.to_json
    post internal_build_progress_path(@build),
         params: body,
         headers: { "X-Signature" => sig(body), "Content-Type" => "application/json" }
    assert_response :ok
    @build.reload
    assert_equal 1, @build.progress_log.length
    assert_equal "added", @build.progress_log.first["event"]
  end

  test "verification_required moves the build to paused_verification" do
    body = "{}"
    post internal_build_verification_required_path(@build),
         params: body,
         headers: { "X-Signature" => sig(body), "Content-Type" => "application/json" }
    assert_response :ok
    assert_equal "paused_verification", @build.reload.status
  end

  test "completed sends ready email when no browser is connected" do
    Rails.cache.delete(BasketBuildChannel.cache_key(@build.id))
    body = { tesco_checkout_url: "http://x", total_pence: 1, unmatched_items: [] }.to_json
    assert_emails 1 do
      perform_enqueued_jobs do
        post internal_build_completed_path(@build),
             params: body,
             headers: { "X-Signature" => sig(body), "Content-Type" => "application/json" }
      end
    end
  end

  test "completed does not send ready email when a browser is connected" do
    BasketBuildChannel.mark_connected(@build.id)
    body = { tesco_checkout_url: "http://x", total_pence: 1, unmatched_items: [] }.to_json
    assert_emails 0 do
      perform_enqueued_jobs do
        post internal_build_completed_path(@build),
             params: body,
             headers: { "X-Signature" => sig(body), "Content-Type" => "application/json" }
      end
    end
  end

  test "completed populates checkout url, total, unmatched, status ready" do
    body = {
      tesco_checkout_url: "http://localhost:4002/checkout/abc123",
      total_pence: 1234,
      unmatched_items: [{ freeform: "asparagus" }],
    }.to_json
    post internal_build_completed_path(@build),
         params: body,
         headers: { "X-Signature" => sig(body), "Content-Type" => "application/json" }
    assert_response :ok
    @build.reload
    assert_equal "ready", @build.status
    assert_equal "http://localhost:4002/checkout/abc123", @build.tesco_checkout_url
    assert_equal 1234, @build.total_pence
    assert_equal 1, @build.unmatched_items.length
    assert_not_nil @build.completed_at
  end

  test "failed sets status failed and error_message" do
    body = { error_message: "boom" }.to_json
    post internal_build_failed_path(@build),
         params: body,
         headers: { "X-Signature" => sig(body), "Content-Type" => "application/json" }
    assert_response :ok
    @build.reload
    assert_equal "failed", @build.status
    assert_equal "boom", @build.error_message
  end

  test "rejects requests with a bad signature" do
    body = "{}"
    post internal_build_progress_path(@build),
         params: body,
         headers: { "X-Signature" => "deadbeef", "Content-Type" => "application/json" }
    assert_response :unauthorized
  end
end
