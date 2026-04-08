require "test_helper"
require "ostruct"

class BillingControllerTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:alice)
    sign_in_as(@user)
    @captured = {}
    captured = @captured

    Stripe::Checkout::Session.singleton_class.alias_method :_orig_create, :create
    Stripe::Checkout::Session.define_singleton_method(:create) do |args|
      captured[:session] = args
      OpenStruct.new(url: "https://checkout.stripe.test/sess_123", id: "sess_123")
    end

    Stripe::BillingPortal::Session.singleton_class.alias_method :_orig_create, :create
    Stripe::BillingPortal::Session.define_singleton_method(:create) do |args|
      captured[:portal] = args
      OpenStruct.new(url: "https://billing.stripe.test/portal_123")
    end

    ENV["STRIPE_PRICE_ID_MONTHLY"] = "price_monthly"
    ENV["STRIPE_PRICE_ID_ANNUAL"]  = "price_annual"
  end

  teardown do
    Stripe::Checkout::Session.singleton_class.alias_method :create, :_orig_create
    Stripe::Checkout::Session.singleton_class.remove_method :_orig_create
    Stripe::BillingPortal::Session.singleton_class.alias_method :create, :_orig_create
    Stripe::BillingPortal::Session.singleton_class.remove_method :_orig_create
    ENV.delete("STRIPE_PRICE_ID_MONTHLY")
    ENV.delete("STRIPE_PRICE_ID_ANNUAL")
  end

  test "show renders" do
    get billing_path
    assert_response :success
  end

  test "checkout creates a Stripe session for the chosen plan and redirects" do
    post checkout_billing_path(plan: "annual")
    assert_equal "subscription", @captured[:session][:mode]
    assert_equal "price_annual", @captured[:session][:line_items].first[:price]
    assert_equal @user.id.to_s, @captured[:session][:client_reference_id]
    assert_redirected_to "https://checkout.stripe.test/sess_123"
  end

  test "checkout defaults to monthly when no plan param" do
    post checkout_billing_path
    assert_equal "price_monthly", @captured[:session][:line_items].first[:price]
  end

  test "checkout uses customer_email when no stripe_customer_id is set" do
    post checkout_billing_path(plan: "monthly")
    assert_equal @user.email, @captured[:session][:customer_email]
    assert_nil @captured[:session][:customer]
  end

  test "checkout uses existing customer when stripe_customer_id is set" do
    @user.update!(stripe_customer_id: "cus_existing")
    post checkout_billing_path(plan: "monthly")
    assert_equal "cus_existing", @captured[:session][:customer]
    assert_nil @captured[:session][:customer_email]
  end

  test "portal redirects to Stripe-hosted portal when customer exists" do
    @user.update!(stripe_customer_id: "cus_existing")
    get portal_billing_path
    assert_equal "cus_existing", @captured[:portal][:customer]
    assert_redirected_to "https://billing.stripe.test/portal_123"
  end

  test "portal flashes alert when no stripe customer yet" do
    get portal_billing_path
    assert_redirected_to billing_path
    follow_redirect!
    assert_match "Manage billing unavailable", flash[:alert] || @response.body
  end

  test "all billing routes require login" do
    delete session_path
    get billing_path
    assert_redirected_to new_session_path
  end
end
