require "application_system_test_case"

class CorrectionsTest < ApplicationSystemTestCase
  setup do
    @captured = []
    captured = @captured
    SidecarClient.singleton_class.alias_method :_orig_start_build, :start_build
    SidecarClient.define_singleton_method(:start_build) do |build, callback_base_url:|
      captured << [:start, build, callback_base_url]
      true
    end
    SidecarClient.singleton_class.alias_method :_orig_search, :search
    SidecarClient.define_singleton_method(:search) do |query|
      captured << [:search, query]
      [
        { "tesco_product_id" => "p010", "name" => "Tesco Whole Milk 2L", "price_text" => "£1.85" },
        { "tesco_product_id" => "p011", "name" => "Tesco Organic Milk 1L", "price_text" => "£1.55" },
      ]
    end
  end

  teardown do
    SidecarClient.singleton_class.alias_method :start_build, :_orig_start_build
    SidecarClient.singleton_class.remove_method :_orig_start_build
    SidecarClient.singleton_class.alias_method :search, :_orig_search
    SidecarClient.singleton_class.remove_method :_orig_search
  end

  def post_callback(build_id, callback_base_url, suffix, body)
    secret = ENV["SIDECAR_HMAC_SECRET"].presence || "dev-secret"
    json = body.to_json
    uri = URI("#{callback_base_url}/internal/builds/#{build_id}/#{suffix}")
    req = Net::HTTP::Post.new(uri)
    req["Content-Type"] = "application/json"
    req["X-Signature"]  = OpenSSL::HMAC.hexdigest("SHA256", secret, json)
    req.body = json
    Net::HTTP.start(uri.host, uri.port) { |http| http.request(req) }
  end

  test "user picks 'wrong?' on a matched item, picks an alternative, ProductMatch is upserted" do
    visit new_registration_path
    fill_in "user_email", with: "corrector@example.com"
    fill_in "user_password", with: "password123"
    fill_in "user_password_confirmation", with: "password123"
    click_on "Sign up"
    assert_current_path list_path
    User.find_by!(email: "corrector@example.com").update!(tesco_session_state: '{"cookies":[]}', tesco_session_saved_at: Time.current)

    fill_in "list_item_freeform_text", with: "milk"
    click_on "Add"
    assert_text "milk"

    click_on "Add to Tesco basket"
    assert_text "Matching your items"

    _, build, callback_base = @captured.find { |c| c.first == :start }
    post_callback(build.id, callback_base, "progress", { event: "added", freeform: "milk", tesco_product_id: "p001" })
    post_callback(build.id, callback_base, "completed", {
      tesco_checkout_url: "http://localhost:4002/checkout/abc",
      total_pence: 185,
      unmatched_items: [],
    })

    assert_text "Your Tesco basket is ready", wait: 5
    assert_text "Matches"

    click_on "wrong?"
    assert_text "Tesco Organic Milk 1L", wait: 3

    user = User.find_by!(email: "corrector@example.com")
    assert_no_difference -> { ProductMatch.where(user: user).count - (ProductMatch.where(user: user).count == 0 ? 0 : 0) } do
      # placeholder; below is the real assertion
    end

    click_on "Tesco Organic Milk 1L"
    Timeout.timeout(5) { sleep 0.05 until ProductMatch.where(user: user, freeform_text: "milk").exists? } rescue nil

    pm = ProductMatch.find_by(user: user, freeform_text: "milk")
    assert_not_nil pm
    assert_equal "p011", pm.tesco_product_id
    assert_equal "Tesco Organic Milk 1L", pm.tesco_product_name
  end
end
