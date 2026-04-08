require "test_helper"

class PwaTest < ActionDispatch::IntegrationTest
  test "manifest.json returns valid JSON with the required PWA fields" do
    get "/manifest.json"
    assert_response :success
    json = JSON.parse(@response.body)
    assert_equal "Kart", json["name"]
    assert_equal "Kart", json["short_name"]
    assert_equal "standalone", json["display"]
    assert_equal "/list", json["start_url"]
    assert json["icons"].any? { |i| i["sizes"] == "192x192" }
    assert json["icons"].any? { |i| i["sizes"] == "512x512" }
    assert json["icons"].any? { |i| i["purpose"] == "maskable" }
  end

  test "service-worker is served" do
    get "/service-worker", headers: { "Accept" => "application/javascript" }
    assert_response :success
    assert_match "self.addEventListener", @response.body
  end

  test "offline.html is served from public" do
    get "/offline.html"
    assert_response :success
    assert_match "You're offline", @response.body
  end
end
