require "application_system_test_case"

class BasketBuildFlowTest < ApplicationSystemTestCase
  setup do
    @captured_builds = []
    captured = @captured_builds
    SidecarClient.singleton_class.alias_method :_orig_start_build, :start_build
    SidecarClient.define_singleton_method(:start_build) do |build, callback_base_url:|
      captured << [build, callback_base_url]
      true
    end
  end

  teardown do
    SidecarClient.singleton_class.alias_method :start_build, :_orig_start_build
    SidecarClient.singleton_class.remove_method :_orig_start_build
  end

  def post_callback(build, callback_base_url, suffix, body)
    secret = ENV["SIDECAR_HMAC_SECRET"].presence || "dev-secret"
    json = body.to_json
    uri = URI("#{callback_base_url}/internal/builds/#{build.id}/#{suffix}")
    req = Net::HTTP::Post.new(uri)
    req["Content-Type"] = "application/json"
    req["X-Signature"]  = OpenSSL::HMAC.hexdigest("SHA256", secret, json)
    req.body = json
    Net::HTTP.start(uri.host, uri.port) { |http| http.request(req) }
  end

  test "owner adds items, taps Add to Tesco basket, sees matching → ready" do
    visit new_registration_path
    fill_in "user_email", with: "buildflow@example.com"
    fill_in "user_password", with: "password123"
    fill_in "user_password_confirmation", with: "password123"
    click_on "Sign up"
    assert_current_path list_path
    User.find_by!(email: "buildflow@example.com").update!(tesco_email: "shop@tesco.com", tesco_password: "secret")

    %w[milk bread].each do |item|
      fill_in "list_item_freeform_text", with: item
      click_on "Add"
      assert_text item
    end

    click_on "Add to Tesco basket"
    assert_text "Matching your items"

    build, callback_base = @captured_builds.last
    post_callback(build, callback_base, "progress", { event: "added", freeform: "milk" })
    sleep 0.3
    post_callback(build, callback_base, "progress", { event: "added", freeform: "bread" })
    sleep 0.3
    post_callback(build, callback_base, "completed", {
      tesco_checkout_url: "http://localhost:4002/checkout/abc123",
      total_pence: 1234,
      unmatched_items: [],
    })

    assert_text "Your Tesco basket is ready", wait: 5
    assert_text "£12.34"
    assert_link "Go to Tesco checkout"
  end

  test "collaborator sees a disabled CTA naming the owner" do
    user = User.create!(email: "cta_owner@example.com", password: "password123")
    user.list.list_items.create!(freeform_text: "milk", quantity: 1, position: 1)

    visit "/s/#{user.list.share_token}"
    assert_text "Only cta_owner@example.com can checkout"
  end
end
