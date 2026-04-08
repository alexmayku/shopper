require "application_system_test_case"

class VerificationPauseTest < ApplicationSystemTestCase
  setup do
    @captured = []
    captured = @captured
    SidecarClient.singleton_class.alias_method :_orig_start_build, :start_build
    SidecarClient.define_singleton_method(:start_build) do |build, callback_base_url:|
      captured << [:start, build, callback_base_url]
      true
    end
    SidecarClient.singleton_class.alias_method :_orig_resume, :send_existing_basket_decision
    SidecarClient.define_singleton_method(:send_existing_basket_decision) do |build, action|
      captured << [:resume, build.id, action]
      true
    end
  end

  teardown do
    SidecarClient.singleton_class.alias_method :start_build, :_orig_start_build
    SidecarClient.singleton_class.remove_method :_orig_start_build
    SidecarClient.singleton_class.alias_method :send_existing_basket_decision, :_orig_resume
    SidecarClient.singleton_class.remove_method :_orig_resume
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

  test "verification pause → user taps Resume → resume call sent" do
    visit new_registration_path
    fill_in "user_email", with: "verify@example.com"
    fill_in "user_password", with: "password123"
    fill_in "user_password_confirmation", with: "password123"
    click_on "Sign up"
    assert_current_path list_path
    User.find_by!(email: "verify@example.com").update!(tesco_email: "shop@tesco.com", tesco_password: "secret")

    fill_in "list_item_freeform_text", with: "milk"
    click_on "Add"
    assert_text "milk"

    click_on "Add to Tesco basket"
    assert_text "Matching your items"

    _, build, callback_base = @captured.find { |c| c.first == :start }
    post_callback(build.id, callback_base, "verification_required", {})

    assert_text "Tesco needs to verify it's you", wait: 5

    click_on "Resume"
    Timeout.timeout(5) { sleep 0.05 until @captured.any? { |c| c.first == :resume } } rescue nil

    assert @captured.any? { |c| c.first == :resume && c.last == "resume" }
    assert_equal "building", build.reload.status
  end
end
