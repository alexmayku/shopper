require "test_helper"

class Internal::ProductMatchesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:alice)
    @secret = "test-secret"
    ENV["SIDECAR_HMAC_SECRET"] = @secret
  end

  teardown { ENV.delete("SIDECAR_HMAC_SECRET") }

  def sig(body)
    OpenSSL::HMAC.hexdigest("SHA256", @secret, body)
  end

  test "GET returns the cached match" do
    pm = product_matches(:alice_milk)
    get internal_user_product_matches_path(@user),
        params: { freeform_text: pm.freeform_text },
        headers: { "X-Signature" => sig("") }
    assert_response :success
    json = JSON.parse(@response.body)
    assert_equal pm.tesco_product_id, json["tesco_product_id"]
    assert_equal pm.tesco_product_name, json["tesco_product_name"]
  end

  test "GET returns 404 for unknown freeform" do
    get internal_user_product_matches_path(@user),
        params: { freeform_text: "nothing here" },
        headers: { "X-Signature" => sig("") }
    assert_response :not_found
  end

  test "POST creates a new ProductMatch" do
    body = { freeform_text: "eggs", tesco_product_id: "p007", tesco_product_name: "Tesco Free Range Eggs", confidence: 0.91 }.to_json
    assert_difference "ProductMatch.count", 1 do
      post internal_user_product_matches_path(@user),
           params: body,
           headers: { "X-Signature" => sig(body), "Content-Type" => "application/json" }
    end
    assert_response :created
  end

  test "POST upserts an existing match" do
    body = { freeform_text: "milk", tesco_product_id: "p999", tesco_product_name: "New Milk", confidence: 0.99 }.to_json
    assert_no_difference "ProductMatch.count" do
      post internal_user_product_matches_path(@user),
           params: body,
           headers: { "X-Signature" => sig(body), "Content-Type" => "application/json" }
    end
    assert_response :created
    pm = ProductMatch.cached_for(@user, "milk")
    assert_equal "p999", pm.tesco_product_id
  end

  test "rejects requests without a valid signature" do
    get internal_user_product_matches_path(@user),
        params: { freeform_text: "milk" },
        headers: { "X-Signature" => "deadbeef" }
    assert_response :unauthorized
  end
end
